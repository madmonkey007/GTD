// 客户端生成 uuid，作为离线创建实体的稳定标识（发送到服务端作为 uid）
export function newUid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	// 旧浏览器兜底
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function newOpId(): string {
	return newUid();
}
