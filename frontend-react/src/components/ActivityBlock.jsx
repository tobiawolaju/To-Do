import React from 'react';

export default function ActivityBlock({ activity, onClick }) {
    const parseTime = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.trim().split(':').map(Number);
        return (hours || 0) * 60 + (minutes || 0);
    };

    const start = parseTime(activity.startTime);
    const end = parseTime(activity.endTime);
    const duration = end - start;

    const style = {
        left: `calc(${start} * var(--pixels-per-minute))`,
        width: `calc(${duration} * var(--pixels-per-minute))`,
        top: `calc(${activity.trackIndex} * var(--grid-track-total))`,
        backgroundColor: hexToRgba(activity.color || '#3b82f6', 0.15),
        borderLeft: `4px solid ${activity.color || '#3b82f6'}`,
        color: 'var(--text-primary)'
    };

    function hexToRgba(hex, alpha) {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
        }
        return hex;
    }

    return (
        <div className="activity-block" style={style} onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}>
            <div className="activity-title">{activity.title}</div>
            <div className="activity-time">{activity.startTime} - {activity.endTime}</div>
        </div>
    );
}
