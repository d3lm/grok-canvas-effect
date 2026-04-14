export type ChannelName = 'red' | 'green' | 'blue' | 'alpha' | 'packed';

export type HandleEnd = 'start' | 'end' | 'widthA' | 'widthB';

export type BlueHandle = 'center' | 'inner' | 'outer' | 'innerV' | 'outerV';

export type DragState =
  | {
      kind: 'alpha';
      gradientIndex: number;
      handle: HandleEnd;
    }
  | {
      kind: 'blue';
      handle: BlueHandle;
    };

export const CHANNEL_META: { key: ChannelName; label: string; desc: string; color: string }[] = [
  { key: 'red', label: 'R', desc: 'Horizontal direction field', color: '#ef4444' },
  { key: 'green', label: 'G', desc: 'Vertical direction field', color: '#22c55e' },
  { key: 'blue', label: 'B', desc: 'Soft glow field', color: '#3b82f6' },
  { key: 'alpha', label: 'A', desc: 'Compositing mask', color: '#a1a1aa' },
  { key: 'packed', label: 'RGBA', desc: 'Packed texture', color: '#a78bfa' },
];

const GRADIENT_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#fd79a8', '#00cec9', '#fab1a0', '#81ecec'];

export function gradientColor(index: number): string {
  return GRADIENT_COLORS[index % GRADIENT_COLORS.length];
}
