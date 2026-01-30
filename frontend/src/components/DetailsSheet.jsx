import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin, Calendar } from 'lucide-react';
import './DetailsSheet.css';

export default function DetailsSheet({ activity, isOpen, onClose, onSave, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(activity || {});
    const [saveStatus, setSaveStatus] = useState('idle');

    // Drag to close state
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const panelRef = useRef(null);

    useEffect(() => {
        if (activity) {
            setEditData(activity);
            setIsEditing(false);
            setSaveStatus('idle');
        }
    }, [activity]);

    // Reset drag when panel opens/closes
    useEffect(() => {
        if (isOpen) {
            setDragY(0);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Touch handlers for drag-to-close
    const handleTouchStart = (e) => {
        // Only allow dragging from the top area (handle zone)
        const touch = e.touches[0];
        const panel = panelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;

        // Allow drag from top 80px (handle area)
        if (touchY <= 80) {
            setIsDragging(true);
            dragStartY.current = touch.clientY;
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - dragStartY.current;

        // Only allow dragging down (positive deltaY)
        if (deltaY > 0) {
            setDragY(deltaY);
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;

        setIsDragging(false);

        // If dragged more than 150px, close the panel
        if (dragY > 150) {
            onClose();
        }

        // Reset position
        setDragY(0);
    };

    if (!activity && !editData.id) return null;

    const handleSave = async () => {
        setSaveStatus('saving');
        const updatedData = {
            ...editData,
            tags: typeof editData.tags === 'string'
                ? editData.tags.split(',').map(t => t.trim()).filter(t => t)
                : editData.tags,
            days: typeof editData.days === 'string'
                ? editData.days.split(',').map(t => t.trim()).filter(t => t)
                : editData.days
        };

        try {
            await onSave(updatedData);
            setSaveStatus('saved');
            setTimeout(() => {
                onClose();
                setIsEditing(false);
                setSaveStatus('idle');
            }, 800);
        } catch (error) {
            console.error("Failed to save:", error);
            setSaveStatus('idle');
            alert("Failed to save changes. Please try again.");
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Completed': 'var(--status-success)',
            'In Progress': 'var(--status-info)',
            'Pending': 'var(--status-warning)',
            'Missed': 'var(--status-error)'
        };
        return colors[status] || 'var(--text-muted)';
    };

    const hexToRgba = (color, alpha) => {
        if (!color) return `rgba(150, 150, 150, ${alpha})`;
        if (color.startsWith('var(')) return color;
        if (color[0] !== '#') return color;

        let r = 0, g = 0, b = 0;
        if (color.length === 4) {
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const renderDays = (days) => {
        if (!days || days.length === 0) {
            return (
                <div className="detail-section">
                    <h3>Schedule</h3>
                    <div className="detail-value" style={{ color: 'var(--text-muted)' }}>Does not repeat</div>
                </div>
            );
        }

        const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const sortedDays = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));

        const isDaily = order.every(d => days.includes(d)) && days.length === 7;
        const isWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].every(d => days.includes(d)) && days.length === 5;

        let label = "";
        if (isDaily) label = "Every Day";
        else if (isWeekdays) label = "Weekdays";

        return (
            <div className="detail-section">
                <h3>Schedule</h3>
                <div className="tags-list">
                    {label ? (
                        <span className="tag-chip day-chip">{label}</span>
                    ) : (
                        sortedDays.map(day => (
                            <span key={day} className="tag-chip day-chip">
                                {day.slice(0, 3)}
                            </span>
                        ))
                    )}
                </div>
            </div>
        );
    };

    const renderView = () => {
        if (!activity) return null;
        const statusColor = getStatusColor(activity.status);

        return (
            <div className="detail-container">
                <div className="detail-header">
                    <h2>{activity.title}</h2>
                    <div style={{ fontSize: '18px', fontWeight: 500, color: statusColor, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{activity.status || 'Pending'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                        <span style={{ color: 'var(--text-primary)' }}>{activity.startTime} — {activity.endTime}</span>
                    </div>
                </div>

                <div className="detail-content">
                    {activity.description && (
                        <div style={{ marginBottom: '32px', fontSize: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                            {activity.description}
                        </div>
                    )}

                    <div style={{ marginBottom: '24px' }}>
                        <div className="detail-label">Location</div>
                        <div className="detail-value" style={{ color: 'var(--text-primary)' }}>{activity.location || 'Remote / Not specified'}</div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <div className="detail-label">Tags</div>
                        <div className="tags-list">
                            {activity.tags && activity.tags.length > 0 ? (
                                activity.tags.map(tag => (
                                    <span key={tag} className="tag-chip">{tag}</span>
                                ))
                            ) : (
                                <span style={{ color: 'var(--text-muted)' }}>No tags</span>
                            )}
                        </div>
                    </div>

                    {renderDays(activity.days)}
                </div>

                <div className="detail-actions" style={{ marginTop: 'auto', paddingTop: '32px' }}>
                    <button
                        className="action-button primary"
                        onClick={() => setIsEditing(true)}
                        style={{ width: '100%', marginBottom: '12px', justifyContent: 'center' }}
                    >
                        Edit Activity
                    </button>
                    <button
                        className="action-button secondary"
                        onClick={() => onDelete(activity.id)}
                        style={{ width: '100%', justifyContent: 'center', border: 'none', color: '#ff3333' }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        );
    };

    const renderEdit = () => (
        <div className="detail-container edit-container">
            <header className="detail-header">
                <h2>Edit Activity</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Modify the details below</p>
            </header>

            <div className="form-content">
                <div className="form-group">
                    <label htmlFor="edit-title">Title</label>
                    <input
                        id="edit-title"
                        type="text"
                        value={editData.title || ''}
                        onChange={e => setEditData({ ...editData, title: e.target.value })}
                        placeholder="Activity name"
                        autoFocus
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                        <label htmlFor="edit-start">Start Time</label>
                        <input
                            id="edit-start"
                            type="time"
                            value={editData.startTime || ''}
                            onChange={e => setEditData({ ...editData, startTime: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-end">End Time</label>
                        <input
                            id="edit-end"
                            type="time"
                            value={editData.endTime || ''}
                            onChange={e => setEditData({ ...editData, endTime: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="edit-location">Location</label>
                    <input
                        id="edit-location"
                        type="text"
                        value={editData.location || ''}
                        onChange={e => setEditData({ ...editData, location: e.target.value })}
                        placeholder="Where will this happen?"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="edit-tags">Tags</label>
                    <input
                        id="edit-tags"
                        type="text"
                        value={Array.isArray(editData.tags) ? editData.tags.join(', ') : (editData.tags || '')}
                        onChange={e => setEditData({ ...editData, tags: e.target.value })}
                        placeholder="startup, portfolio"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="edit-days">Repeat Days</label>
                    <input
                        id="edit-days"
                        type="text"
                        value={Array.isArray(editData.days) ? editData.days.join(', ') : (editData.days || '')}
                        onChange={e => setEditData({ ...editData, days: e.target.value })}
                        placeholder="Friday"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="edit-description">Notes</label>
                    <textarea
                        id="edit-description"
                        value={editData.description || ''}
                        onChange={e => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Additional details..."
                        style={{ height: 'auto', resize: 'vertical' }}
                    />
                </div>
            </div>

            <div className="detail-actions" style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                <button
                    className="action-button primary"
                    onClick={handleSave}
                    disabled={saveStatus !== 'idle'}
                    style={{ flex: 2, justifyContent: 'center' }}
                >
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                    className="action-button secondary"
                    onClick={() => setIsEditing(false)}
                    style={{ flex: 1, justifyContent: 'center' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );

    // Calculate panel style - only apply inline transform when dragging
    // valid CSS classes handle the open/closed states responsively
    const panelStyle = {
        transform: isDragging ? `translateY(${dragY}px)` : undefined,
        transition: isDragging ? 'none' : undefined
    };

    return (
        <>
            <div
                className={`details-panel-overlay ${isOpen ? 'active' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                className={`details-panel ${isOpen ? 'open' : ''}`}
                style={panelStyle}
                role="dialog"
                aria-modal="true"
                aria-labelledby="details-title"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag handle - visible only on mobile via CSS */}
                <div
                    className="drag-handle"
                    style={{
                        width: '100%',
                        height: '24px',
                        display: 'flex',
                        justifyContent: 'center',
                        cursor: 'grab',
                        marginBottom: '12px',
                        touchAction: 'none'
                    }}
                >
                    <div style={{
                        width: '32px',
                        height: '4px',
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '0px',
                    }} />
                </div>
                {isEditing ? renderEdit() : renderView()}
            </div>
        </>
    );
}
