"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function AnimatedCardContent({
    contentKey,
    children,
    duration = 400
}: {
    contentKey: string;
    children: ReactNode;
    duration?: number;
}) {
    const [displayed, setDisplayed] = useState(children);
    const [opacity, setOpacity] = useState(1);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirst = useRef(true);

    useEffect(() => {
        if (isFirst.current) {
            isFirst.current = false;
            return;
        }

        setOpacity(0);
        timerRef.current = setTimeout(() => {
            setDisplayed(children);
            setOpacity(1);
        }, duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
        // contentKey is the trigger — children are read from closure on change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentKey]);

    return (
        <div
            style={{
                opacity,
                transition: `opacity ${duration}ms ease-in-out`
            }}>
            {displayed}
        </div>
    );
}
