"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TIMER_DURATION_SECONDS } from "../constants";

interface UseZeroThinkTimerReturn {
	timeRemaining: number;
	isRunning: boolean;
	isExpired: boolean;
	progress: number;
	start: () => void;
	stop: () => void;
	reset: () => void;
}

export function useZeroThinkTimer(): UseZeroThinkTimerReturn {
	const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION_SECONDS);
	const [isRunning, setIsRunning] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef<number | null>(null);
	const pausedTimeRef = useRef<number>(0);

	const isExpired = timeRemaining <= 0;
	const progress =
		(TIMER_DURATION_SECONDS - timeRemaining) / TIMER_DURATION_SECONDS;

	const clearTimerInterval = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	const tick = useCallback(() => {
		setTimeRemaining((prev) => {
			const next = prev - 1;
			return next <= 0 ? 0 : next;
		});
	}, []);

	const start = useCallback(() => {
		if (timeRemaining <= 0) return;
		setIsRunning(true);
		startTimeRef.current = Date.now();
		intervalRef.current = setInterval(tick, 1000);
	}, [timeRemaining, tick]);

	const stop = useCallback(() => {
		setIsRunning(false);
		clearTimerInterval();
		if (startTimeRef.current !== null) {
			pausedTimeRef.current = timeRemaining;
		}
	}, [clearTimerInterval, timeRemaining]);

	const reset = useCallback(() => {
		clearTimerInterval();
		setTimeRemaining(TIMER_DURATION_SECONDS);
		setIsRunning(false);
		startTimeRef.current = null;
		pausedTimeRef.current = 0;
	}, [clearTimerInterval]);

	// Stop interval when expired
	useEffect(() => {
		if (isExpired && isRunning) {
			clearTimerInterval();
			setIsRunning(false);
		}
	}, [isExpired, isRunning, clearTimerInterval]);

	// Handle page visibility: pause when tab hidden, resume when visible
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				// Tab hidden: pause
				if (intervalRef.current !== null) {
					clearTimerInterval();
					pausedTimeRef.current = timeRemaining;
				}
			} else {
				// Tab visible: resume if was running
				if (isRunning && !isExpired) {
					intervalRef.current = setInterval(tick, 1000);
				}
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
			clearTimerInterval();
		};
	}, [isRunning, isExpired, timeRemaining, tick, clearTimerInterval]);

	return {
		timeRemaining,
		isRunning,
		isExpired,
		progress,
		start,
		stop,
		reset,
	};
}
