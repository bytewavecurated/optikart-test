import React, { useState } from 'react';
import { FiStar } from 'react-icons/fi';

const styles = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: "'Roboto', sans-serif",
  },
  starsWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
  },
  star: {
    cursor: 'default',
    transition: 'color 0.15s, transform 0.15s',
  },
  starInteractive: {
    cursor: 'pointer',
  },
  ratingText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  countText: {
    fontSize: '13px',
    color: '#888',
  },
};

function getStarFill(rating, index) {
  const diff = rating - index;
  if (diff >= 1) return 'full';
  if (diff >= 0.5) return 'half';
  return 'empty';
}

function StarIcon({ fill, size, color, hoverColor, onMouseEnter, onMouseLeave, onClick, interactive }) {
  const fillColor = hoverColor || color;

  if (fill === 'full') {
    return (
      <FiStar
        size={size}
        style={{
          color: fillColor,
          fill: fillColor,
          cursor: interactive ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />
    );
  }

  if (fill === 'half') {
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: `${size}px`,
          height: `${size}px`,
          cursor: interactive ? 'pointer' : 'default',
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <FiStar
          size={size}
          style={{
            color: '#ddd',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '50%',
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <FiStar
            size={size}
            style={{
              color: fillColor,
              fill: fillColor,
            }}
          />
        </span>
      </span>
    );
  }

  return (
    <FiStar
      size={size}
      style={{
        color: '#ddd',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    />
  );
}

export default function StarRating({
  rating = 0,
  count,
  size = 18,
  interactive = false,
  onChange,
  showNumber = true,
  color = '#ff9f00',
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  const handleClick = (index) => {
    if (interactive && onChange) {
      onChange(index + 1);
    }
  };

  const handleMouseEnter = (index) => {
    if (interactive) {
      setHoverRating(index + 1);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.starsWrap}>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = getStarFill(displayRating, i);
          return (
            <StarIcon
              key={i}
              fill={fill}
              size={size}
              color={color}
              hoverColor={interactive ? '#ffb84d' : color}
              interactive={interactive}
              onMouseEnter={() => handleMouseEnter(i)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(i)}
            />
          );
        })}
      </div>

      {showNumber && (
        <span style={styles.ratingText}>{displayRating.toFixed(1)}</span>
      )}

      {count !== undefined && (
        <span style={styles.countText}>({count})</span>
      )}
    </div>
  );
}
