import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin } from 'lucide-react';

export default function DetailsSheet({ activity, isOpen, onClose, onSave, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(activity || {});
    const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved'

    useEffect(() => {
        if (activity) {
            setEditData(activity);
            setIsEditing(false);
            setSaveStatus('idle');
        }
    }, [activity]);

    if (!activity && !editData.id) return null;

    const handleSave = async () => {
        setSaveStatus('saving');
        const updatedData = {
            ...editData,
            tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()).filter(t => t) : editData.tags,
            days: typeof editData.days === 'string' ? editData.days.split(',').map(t => t.trim()).filter(t => t) : editData.days
        };

        try {
            await onSave(updatedData);
            setSaveStatus('saved');
            // Wait 1 second before closing
            setTimeout(() => {
                onClose();
                setIsEditing(false);
                setSaveStatus('idle');
            }, 1000);
        } catch (error) {
            console.error("Failed to save:", error);
            setSaveStatus('idle');
            alert("Failed to save changes. Please try again.");
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Completed': '#4CAF50',
            'In Progress': '#2196F3',
            'Pending': '#FFC107',
            'Missed': '#F44336'
        };
        return colors[status] || '#999';
    };

    const hexToRgba = (hex, alpha) => {
        if (!hex || hex[0] !== '#') return hex;
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const renderDays = (days) => {
        if (!days || days.length === 0) return null;
        const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const sortedDays = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));

        const isDaily = order.every(d => days.includes(d)) && days.length === 7;
        const isWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].every(d => days.includes(d)) && days.length === 5;

        let label = "";
        if (isDaily) label = "Every Day";
        else if (isWeekdays) label = "Weekdays";

        return (
            <div className="detail-section">
                <h3>Active Days</h3>
                <div className="tags-list">
                    {label ? (
                        <span className="tag-chip day-chip">{label}</span>
                    ) : (
                        sortedDays.map(day => <span key={day} className="tag-chip day-chip">{day}</span>)
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
                <button className="close-panel-btn" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>
                <header className="detail-header">
                    <div className="detail-title-row">
                        <span className="status-chip" style={{
                            backgroundColor: hexToRgba(statusColor, 0.1),
                            color: statusColor,
                            border: `1px solid ${hexToRgba(statusColor, 0.2)}`
                        }}>
                            {activity.status || 'Scheduled'}
                        </span>
                        <h2>{activity.title}</h2>
                    </div>
                    <div className="detail-time">
                        <Clock size={16} />
                        {activity.startTime} to {activity.endTime}
                    </div>
                </header>

                {activity.description && (
                    <div className="detail-section">
                        <h3>Description</h3>
                        <p>{activity.description}</p>
                    </div>
                )}

                <div className="detail-grid">
                    <div className="detail-section">
                        <h3>Location</h3>
                        <div className="detail-value">
                            <MapPin size={16} />
                            {activity.location || 'Remote / None'}
                        </div>
                    </div>

                    {activity.tags && activity.tags.length > 0 && (
                        <div className="detail-section">
                            <h3>Tags</h3>
                            <div className="tags-list">
                                {activity.tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)}
                            </div>
                        </div>
                    )}
                </div>

                {renderDays(activity.days)}

                <div className="detail-actions">
                    <button className="action-button primary" onClick={() => setIsEditing(true)}>Edit Details</button>
                    <button className="action-button secondary" onClick={() => onDelete(activity.id)}>Delete</button>
                </div>
            </div>
        );
    };

    const renderEdit = () => (
        <div className="detail-container edit-container">
            <header className="detail-header">
                <h2>Edit Activity</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Modify the details of your scheduled activity.</p>
            </header>

            <div className="form-group">
                <label>Activity Title</label>
                <input type="text" value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} />
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                    <label>Start Time</label>
                    <input type="time" value={editData.startTime} onChange={e => setEditData({ ...editData, startTime: e.target.value })} />
                </div>
                <div className="form-group">
                    <label>End Time</label>
                    <input type="time" value={editData.endTime} onChange={e => setEditData({ ...editData, endTime: e.target.value })} />
                </div>
            </div>

            <div className="form-group">
                <label>Location</label>
                <input type="text" value={editData.location || ''} onChange={e => setEditData({ ...editData, location: e.target.value })} />
            </div>

            <div className="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" value={Array.isArray(editData.tags) ? editData.tags.join(', ') : (editData.tags || '')} onChange={e => setEditData({ ...editData, tags: e.target.value })} />
            </div>

            <div className="form-group">
                <label>Recurrence Days (comma separated)</label>
                <input type="text" value={Array.isArray(editData.days) ? editData.days.join(', ') : (editData.days || '')} onChange={e => setEditData({ ...editData, days: e.target.value })} />
            </div>

            <div className="form-group">
                <label>Notes / Description</label>
                <textarea value={editData.description || ''} onChange={e => setEditData({ ...editData, description: e.target.value })} style={{ minHeight: '100px' }} />
            </div>

            <div className="detail-actions">
                <button
                    className="action-button primary"
                    onClick={handleSave}
                    disabled={saveStatus !== 'idle'}
                >
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save Changes'}
                </button>
                <button className="action-button secondary" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
        </div>
    );

    return (
        <>
            <div className={`details-panel-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}></div>
            <div className={`details-panel ${isOpen ? 'open' : ''}`}>
                {isEditing ? renderEdit() : renderView()}
            </div>
        </>
    );
}
