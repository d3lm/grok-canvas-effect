import { cn } from '../lib/utils';
import type { ChannelName } from './types';

export function CanvasPreview({
  channelKey,
  activeChannel,
  children,
  setCanvasRef,
}: {
  channelKey: ChannelName;
  activeChannel: ChannelName;
  children?: React.ReactNode;
  setCanvasRef: (key: ChannelName) => (element: HTMLCanvasElement | null) => void;
}) {
  return (
    <div
      className={cn(
        'relative min-h-0 min-w-0 leading-none',
        activeChannel === channelKey ? 'flex items-center justify-center' : 'hidden',
      )}
    >
      <canvas ref={setCanvasRef(channelKey)} className="block max-h-full max-w-full rounded object-contain" />
      {children}
    </div>
  );
}
