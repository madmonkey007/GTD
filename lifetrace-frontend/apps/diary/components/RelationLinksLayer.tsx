"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface RelationEdge {
	from: number;
	to: number;
}

interface RelationLinksLayerProps {
	/** 容器（滚动内容根），SVG 覆盖层与卡片坐标系一致 */
	containerRef: React.RefObject<HTMLDivElement | null>;
	/** 有向边：from 引用 to（箭头从 from 指向 to） */
	edges: RelationEdge[];
	/** 拖拽端点重接关系：endpoint 指明拖的是哪端，noteId 为松手命中的卡片 */
	onReroute?: (edge: RelationEdge, endpoint: "from" | "to", noteId: number) => void;
}

/** 路由后的折线点列（含端点）；直线不穿卡时就是两点 */
interface Route {
	pts: { x: number; y: number }[];
}

interface DragState {
	edgeIndex: number;
	endpoint: "from" | "to";
	x: number;
	y: number;
}

/** 聚焦模式下在成员卡片之间绘制引用连线：贝塞尔曲线 + 箭头，方向 = from 引用 to。
 *  两端有可拖拽手柄：拖到另一张卡上松手即可重接该端的关系。 */
export function RelationLinksLayer({ containerRef, edges, onReroute }: RelationLinksLayerProps) {
	const [routes, setRoutes] = useState<Route[]>([]);
	const [drag, setDrag] = useState<DragState | null>(null);
	const [hoverNote, setHoverNote] = useState<number | null>(null);
	const svgRef = useRef<SVGSVGElement>(null);

	const measure = useCallback(() => {
		const container = containerRef.current;
		if (!container || edges.length === 0) {
			setRoutes([]);
			return;
		}
		const containerRect = container.getBoundingClientRect();
		const elById = new Map<number, DOMRect>();
		for (const e of edges) {
			for (const id of [e.from, e.to]) {
				if (elById.has(id)) continue;
				const el = container.querySelector<HTMLElement>(`[data-relation-node="${id}"]`);
				if (el) elById.set(id, el.getBoundingClientRect());
			}
		}
		// 所有卡片矩形（容器坐标，外扩 8px 作为禁走区），用于绕行检测
		const PAD = 8;
		const obstacles = [...container.querySelectorAll<HTMLElement>("[data-relation-node]")]
			.map((el) => {
				const r = el.getBoundingClientRect();
				return { x1: r.left - containerRect.left - PAD, y1: r.top - containerRect.top - PAD, x2: r.right - containerRect.left + PAD, y2: r.bottom - containerRect.top + PAD };
			});
		// 直线段（线段与矩形相交检测，端点在矩形内也算）
		const segHitsRect = (ax: number, ay: number, bx: number, by: number, o: { x1: number; y1: number; x2: number; y2: number }) => {
			const inside = (x: number, y: number) => x >= o.x1 && x <= o.x2 && y >= o.y1 && y <= o.y2;
			if (inside(ax, ay) || inside(bx, by)) return true;
			const pts: [number, number, number, number][] = [
				[o.x1, o.y1, o.x2, o.y1], [o.x2, o.y1, o.x2, o.y2],
				[o.x2, o.y2, o.x1, o.y2], [o.x1, o.y2, o.x1, o.y1],
			];
			// 线段相交
			const cross = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number, p4x: number, p4y: number) => {
				const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
				if (d === 0) return false;
				const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
				const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
				return t >= 0 && t <= 1 && u >= 0 && u <= 1;
			};
			return pts.some(([qx1, qy1, qx2, qy2]) => cross(ax, ay, bx, by, qx1, qy1, qx2, qy2));
		};
		const next: Route[] = [];
		for (const e of edges) {
			const a = elById.get(e.from);
			const b = elById.get(e.to);
			if (!a || !b) continue;
			const center = (r: DOMRect) => ({
				x: r.left + r.width / 2 - containerRect.left,
				y: r.top + r.height / 2 - containerRect.top,
			});
			const ca = center(a);
			const cb = center(b);
			const dx = cb.x - ca.x;
			const dy = cb.y - ca.y;
			// 按主方向选边锚点：垂直流动画上下边中点，水平流动画左右边中点
			const vertical = Math.abs(dy) >= Math.abs(dx);
			const anchor = (c: { x: number; y: number }, r: DOMRect, isSource: boolean): { x: number; y: number } => {
				if (vertical) {
					// 源点在指向侧边，终点在背向侧边（箭头指向卡片）
					const topEdge = { x: c.x, y: r.top - containerRect.top };
					const bottomEdge = { x: c.x, y: r.bottom - containerRect.top };
					const forward = dy >= 0;
					return isSource ? (forward ? bottomEdge : topEdge) : (forward ? topEdge : bottomEdge);
				}
				const leftEdge = { x: r.left - containerRect.left, y: c.y };
				const rightEdge = { x: r.right - containerRect.left, y: c.y };
				const forward = dx >= 0;
				return isSource ? (forward ? rightEdge : leftEdge) : (forward ? leftEdge : rightEdge);
			};
			const start = anchor(ca, a, true);
			const end = anchor(cb, b, false);
			if (Math.hypot(end.x - start.x, end.y - start.y) < 4) continue;
			// 直连是否穿卡
			const directBlocked = obstacles.some((o) => segHitsRect(start.x, start.y, end.x, end.y, o));
			if (!directBlocked) {
				next.push({ pts: [start, end] });
				continue;
			}
			// 绕行：找一条 x 走廊（候选 = 容器左右边、列间隙中心、各卡片左右外缘），
			// 使 start→(corridor,start.y 的水平/垂直组合)→end 的折线全程不穿卡
			const midY = (start.y + end.y) / 2;
			const corridorCands = new Set<number>([
				PAD, containerRect.width - PAD,
				...obstacles.flatMap((o) => [o.x1 - PAD, o.x2 + PAD]),
			]);
			// 列间隙：两卡水平相邻时的中缝
			for (let i = 0; i < obstacles.length; i++) {
				for (let j = 0; j < obstacles.length; j++) {
					const g = (obstacles[i].x2 + obstacles[j].x1) / 2;
					if (g > 0 && g < containerRect.width) corridorCands.add(g);
				}
			}
			let best: { pts: { x: number; y: number }[]; len: number } | null = null;
			for (const cx of corridorCands) {
				// 三段折线：start →(cx,start.y)→(cx,end.y)→ end（先竖后横的变体也测）
				const variants: { x: number; y: number }[][] = [
					[start, { x: cx, y: start.y }, { x: cx, y: end.y }, end],
					[start, { x: start.x, y: midY }, { x: cx, y: midY }, { x: cx, y: end.y }, end],
				];
				for (const pts of variants) {
					const ok = pts.slice(0, -1).every((p, k) => {
						const q = pts[k + 1];
						return !obstacles.some((o) => segHitsRect(p.x, p.y, q.x, q.y, o));
					});
					if (ok) {
						const len = pts.slice(0, -1).reduce((s, p, k) => s + Math.hypot(pts[k + 1].x - p.x, pts[k + 1].y - p.y), 0);
						if (!best || len < best.len) best = { pts, len };
					}
				}
			}
			if (best) next.push({ pts: best.pts });
			// 找不到无碰撞走廊时退回直连（被卡片遮住一段，但保持拓扑可见）
			else next.push({ pts: [start, end] });
		}
		setRoutes(next);
	}, [containerRef, edges]);

	useLayoutEffect(() => {
		measure();
	}, [measure]);

	// 卡片高度变化 / 容器尺寸变化时重算
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(() => measure());
		observer.observe(container);
		for (const el of container.querySelectorAll<HTMLElement>("[data-relation-node]")) {
			observer.observe(el);
		}
		return () => observer.disconnect();
	}, [containerRef, edges, measure]);

	const toContainerPos = useCallback((clientX: number, clientY: number) => {
		const container = containerRef.current;
		if (!container) return null;
		const r = container.getBoundingClientRect();
		return { x: clientX - r.left, y: clientY - r.top };
	}, [containerRef]);

	// 松手时命中的卡片：优先手柄自身 elementFromPoint（手柄会挡住卡片），回退到偏移点
	const hitNoteAt = useCallback((clientX: number, clientY: number): number | null => {
		const hit = (el: Element | null): number | null => {
			const node = el?.closest?.("[data-relation-node]");
			const id = node?.getAttribute("data-relation-node");
			return id ? Number(id) : null;
		};
		const direct = hit(document.elementFromPoint(clientX, clientY));
		if (direct !== null) return direct;
		// 手柄自身挡住时，向连线方向偏移一点再探测
		const shifted = hit(document.elementFromPoint(clientX - 20, clientY)) ?? hit(document.elementFromPoint(clientX + 20, clientY));
		return shifted;
	}, []);

	const startDrag = (edgeIndex: number, endpoint: "from" | "to") => (e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const pos = toContainerPos(e.clientX, e.clientY);
		if (pos) setDrag({ edgeIndex, endpoint, x: pos.x, y: pos.y });
	};

	const onHandleMove = (e: React.PointerEvent) => {
		if (!drag) return;
		const pos = toContainerPos(e.clientX, e.clientY);
		if (!pos) return;
		setDrag({ ...drag, x: pos.x, y: pos.y });
		setHoverNote(hitNoteAt(e.clientX, e.clientY));
	};

	const onHandleUp = (e: React.PointerEvent) => {
		if (!drag) return;
		const hitId = hitNoteAt(e.clientX, e.clientY);
		const edge = edges[drag.edgeIndex];
		setDrag(null);
		setHoverNote(null);
		if (!hitId || !edge) return;
		// 落回原卡片或落向另一端卡片 = 无变化
		const current = drag.endpoint === "from" ? edge.from : edge.to;
		const other = drag.endpoint === "from" ? edge.to : edge.from;
		if (hitId === current || hitId === other) return;
		onReroute?.(edge, drag.endpoint, hitId);
	};

	if (routes.length === 0 && !drag) return null;

	// 拖拽中的路线：被拖端点替换为手柄当前位置
	const routeFor = (r: Route, i: number): Route => {
		if (!drag || drag.edgeIndex !== i) return r;
		const pts = [...r.pts];
		if (drag.endpoint === "from") pts[0] = { x: drag.x, y: drag.y };
		else pts[pts.length - 1] = { x: drag.x, y: drag.y };
		return { pts };
	};

	// 折线点列 → 贝塞尔 path：两点直连用对称控制点的流向曲线；
	// 多点绕行用 Catmull-Rom 转三次贝塞尔，转角平滑但整体仍避开卡片
	const pathFor = (pts: { x: number; y: number }[]): string => {
		if (pts.length === 2) {
			const [a, b] = pts;
			const my = (a.y + b.y) / 2;
			return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
		}
		const tension = 0.35;
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let k = 0; k < pts.length - 1; k++) {
			const p0 = pts[k - 1] ?? pts[k];
			const p1 = pts[k];
			const p2 = pts[k + 1];
			const p3 = pts[k + 2] ?? p2;
			const c1 = { x: p1.x + (p2.x - p0.x) * tension / 2, y: p1.y + (p2.y - p0.y) * tension / 2 };
			const c2 = { x: p2.x - (p3.x - p1.x) * tension / 2, y: p2.y - (p3.y - p1.y) * tension / 2 };
			d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
		}
		return d;
	};

	// 双层渲染：连线层覆盖在卡片上方，但路由保证折线只走空隙（不穿卡），
	// 因此不会遮挡卡片内容；手柄层更高一层保证可拖。
	return (
		<>
		<svg
			ref={svgRef}
			className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
			aria-hidden="true"
		>
			{hoverNote !== null && (() => {
				const container = containerRef.current;
				const el = container?.querySelector<HTMLElement>(`[data-relation-node="${hoverNote}"]`);
				if (!el || !container) return null;
				const r = el.getBoundingClientRect();
				const cr = container.getBoundingClientRect();
				return (
					<rect
						x={r.left - cr.left - 3}
						y={r.top - cr.top - 3}
						width={r.width + 6}
						height={r.height + 6}
						rx={10}
						className="fill-primary/5 stroke-primary/60"
						strokeWidth={1.5}
						strokeDasharray="4 3"
					/>
				);
			})()}
			{routes.map((raw, i) => {
				const r = routeFor(raw, i);
				const d = pathFor(r.pts);
				const isDragging = drag?.edgeIndex === i;
				return (
					<path
						key={i}
						d={d}
						className={isDragging ? "stroke-primary" : "stroke-primary/70"}
						strokeWidth={isDragging ? 2 : 1.5}
						strokeLinejoin="round"
						fill="none"
						markerEnd="url(#relation-arrow)"
					/>
				);
			})}
		</svg>
		<svg
			className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
			aria-hidden="true"
		>
			<defs>
				<marker id="relation-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M0,1 L7,4 L0,7 z" className="fill-primary/60" />
				</marker>
			</defs>
			{routes.map((raw, i) => {
				const r = routeFor(raw, i);
				const head = r.pts[0];
				const tail = r.pts[r.pts.length - 1];
				const handleCls = "pointer-events-auto cursor-grab fill-background stroke-primary/70 transition-[r] hover:r-3 active:cursor-grabbing";
				return (
					<g key={`h-${i}`}>
						<circle
							cx={head.x}
							cy={head.y}
							r={drag?.edgeIndex === i && drag.endpoint === "from" ? 4 : 2.5}
							className={handleCls}
							strokeWidth={1.5}
							onPointerDown={startDrag(i, "from")}
							onPointerMove={onHandleMove}
							onPointerUp={onHandleUp}
							onPointerCancel={onHandleUp}
						>
							<title>拖动改变引用发起方</title>
						</circle>
						<circle
							cx={tail.x}
							cy={tail.y}
							r={drag?.edgeIndex === i && drag.endpoint === "to" ? 4 : 2.5}
							className={handleCls}
							strokeWidth={1.5}
							onPointerDown={startDrag(i, "to")}
							onPointerMove={onHandleMove}
							onPointerUp={onHandleUp}
							onPointerCancel={onHandleUp}
						>
							<title>拖动改变引用目标</title>
						</circle>
					</g>
				);
			})}
		</svg>
		</>
	);
}
