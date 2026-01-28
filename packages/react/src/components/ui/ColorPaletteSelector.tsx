/**
 * ColorPaletteSelector component for selecting chart color palettes.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a color string to rgba with specified alpha.
 * Supports: hex (3, 4, 6, 8 digit), rgb(), and rgba() formats.
 * Other formats (named colors, hsl, etc.) are returned unchanged.
 */
function colorWithAlpha(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    let hex = color.slice(1);

    // Expand shorthand (3 or 4 digit) to full form
    if (hex.length === 3) {
      hex = (hex[0] ?? '') + (hex[0] ?? '') + (hex[1] ?? '') + (hex[1] ?? '') + (hex[2] ?? '') + (hex[2] ?? '');
    } else if (hex.length === 4) {
      hex = (hex[0] ?? '') + (hex[0] ?? '') + (hex[1] ?? '') + (hex[1] ?? '') + (hex[2] ?? '') + (hex[2] ?? '') + (hex[3] ?? '') + (hex[3] ?? '');
    }

    // Parse RGB values (ignore existing alpha if 8-digit hex)
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // Handle rgb() format
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }

  // Handle rgba() format - replace alpha
  const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
  }

  // Fallback: unsupported format (named colors, hsl, etc.) - return unchanged
  return color;
}

// ============================================================================
// Types
// ============================================================================

export interface ColorPaletteSelectorProps {
  /** Current selected palette colors. */
  value: string[] | undefined;
  /** Callback when palette changes. */
  onChange: (colors: string[] | undefined) => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Default',
    colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'],
  },
  {
    name: 'Vibrant',
    colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
  },
  {
    name: 'Ocean',
    colors: ['#1A535C', '#4ECDC4', '#F7FFF7', '#FF6B6B', '#FFE66D', '#2EC4B6', '#CBF3F0', '#FFBF69'],
  },
  {
    name: 'Sunset',
    colors: ['#F72585', '#B5179E', '#7209B7', '#560BAD', '#480CA8', '#3A0CA3', '#3F37C9', '#4361EE'],
  },
  {
    name: 'Forest',
    colors: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC', '#1B4332'],
  },
  {
    name: 'Monochrome',
    colors: ['#212529', '#343A40', '#495057', '#6C757D', '#ADB5BD', '#CED4DA', '#DEE2E6', '#E9ECEF'],
  },
  {
    name: 'Warm',
    colors: ['#D00000', '#DC2F02', '#E85D04', '#F48C06', '#FAA307', '#FFBA08', '#FFC94D', '#FFE066'],
  },
  {
    name: 'Cool',
    colors: ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#ADE8F4'],
  },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Color palette selector with visual preview.
 */
export function ColorPaletteSelector({
  value,
  onChange,
  className,
}: ColorPaletteSelectorProps): JSX.Element {
  const { theme } = useTheme();

  // Find currently selected palette
  const selectedPalette = PALETTES.find(
    (p) => JSON.stringify(p.colors) === JSON.stringify(value)
  )?.name ?? 'Custom';

  const handleSelect = useCallback(
    (palette: typeof PALETTES[number]) => {
      onChange(palette.colors);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const paletteGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
  };

  const paletteItemStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: theme.spacing.sm,
    border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    backgroundColor: isSelected ? colorWithAlpha(theme.colors.primary, 0.1) : 'transparent',
    transition: 'all 0.15s ease',
  });

  const paletteNameStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const swatchContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '2px',
    height: '16px',
  };

  const swatchStyle = (color: string): React.CSSProperties => ({
    flex: 1,
    backgroundColor: color,
    borderRadius: '2px',
  });

  return (
    <div className={className} style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={labelStyle}>Color Palette</span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              fontSize: theme.fontSizes.xs,
              color: theme.colors.primary,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset to default
          </button>
        )}
      </div>

      <div style={paletteGridStyle}>
        {PALETTES.map((palette) => (
          <button
            key={palette.name}
            type="button"
            onClick={() => handleSelect(palette)}
            style={paletteItemStyle(selectedPalette === palette.name)}
          >
            <div style={paletteNameStyle}>{palette.name}</div>
            <div style={swatchContainerStyle}>
              {palette.colors.slice(0, 6).map((color, i) => (
                <div key={`${color}-${i}`} style={swatchStyle(color)} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
