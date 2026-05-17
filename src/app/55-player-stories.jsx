function PlayerStoryModal({ story, onButton, children, className = '' }) {
  if (!story) return null;
  const labels = story.buttons && story.buttons.length ? story.buttons : ['继续'];
  const storyIdClass = story.id ? `player-story-${String(story.id).replace(/[^a-z0-9_-]/gi, '-')}` : '';
  return (
    <div className="modal-overlay player-story-overlay">
      <div className={`modal event-modal player-story-modal ${storyIdClass} ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-tag">{story.tag}</div>
        <div className="modal-title">{story.title}</div>
        {story.image && (
          <div className="player-story-image">
            <img src={story.image} alt="" draggable="false" />
          </div>
        )}
        <div className="player-story-dialogue">
          {(story.paragraphs || []).map((line, idx) => (
            <p key={idx}>{formatNarrativeText(line, 42)}</p>
          ))}
        </div>
        {children}
        <div className="modal-options player-story-actions">
          {labels.map((label, idx) => (
            <button key={label} className={`modal-option ${idx === 0 ? 'player-story-primary-action' : ''}`} onClick={() => onButton?.(idx, label)}>
              <div className="modal-option-label">{label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
