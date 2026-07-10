"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerPhase = "work" | "break";

interface TimerDurations {
	work: number; // seconds
	break: number; // seconds
}

const DEFAULT_DURATIONS: TimerDurations = {
	work: 25 * 60,
	break: 5 * 60,
};

interface UseTimerReturn {
	isRunning: boolean;
	timeLeft: number;
	phase: TimerPhase;
	progress: number; // 0-1
	start: () => void;
	pause: () => void;
	reset: () => void;
	toggle: () => void;
	durations: TimerDurations;
}

export function useTimer(
	durations: TimerDurations = DEFAULT_DURATIONS,
	onWorkComplete?: () => void,
): UseTimerReturn {
	const [isRunning, setIsRunning] = useState(false);
	const [timeLeft, setTimeLeft] = useState(durations.work);
	const [phase, setPhase] = useState<TimerPhase>("work");
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const onCompleteRef = useRef<() => void>(() => {});

	const clearTimer = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const start = useCallback(() => {
		clearTimer();
		setIsRunning(true);
	}, [clearTimer]);

	const pause = useCallback(() => {
		clearTimer();
		setIsRunning(false);
	}, [clearTimer]);

	const reset = useCallback(() => {
		clearTimer();
		setIsRunning(false);
		setPhase("work");
		setTimeLeft(durations.work);
	}, [clearTimer, durations.work]);

	const toggle = useCallback(() => {
		if (isRunning) {
			pause();
		} else {
			start();
		}
	}, [isRunning, start, pause]);

	// Switch phase when timer hits 0
	onCompleteRef.current = useCallback(() => {
		setPhase((prev) => {
			if (prev === "work") onWorkComplete?.();
			return prev; // keep phase unchanged, don't auto-switch
		});
		// Don't auto-start - stay stopped at 0
	}, [onWorkComplete]);

	// Countdown tick
	useEffect(() => {
		if (!isRunning) {
			clearTimer();
			return;
		}

		intervalRef.current = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					clearTimer();
					setIsRunning(false);
					// Use setTimeout to let state settle
					setTimeout(() => {
						onCompleteRef.current();
					}, 0);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return clearTimer;
	}, [isRunning, clearTimer]);

	// Cleanup on unmount
	useEffect(() => {
		return clearTimer;
	}, [clearTimer]);

	const totalDuration = phase === "work" ? durations.work : durations.break;
	const progress = 1 - timeLeft / totalDuration;

	return {
		isRunning,
		timeLeft,
		phase,
		progress,
		start,
		pause,
		reset,
		toggle,
		durations,
	};
}
