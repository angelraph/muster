// Records travel phone-to-phone as QR codes when there is no network at all:
// the volunteer heading back towards signal scans the others and carries everyone's records.
import { useEffect, useRef, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { encodeFrames, FrameCollector } from '../core/handoff';
import type { Household } from '../core/types';
import { saveHousehold } from '../store';

export function Handoff({ mine, onClose }: { mine: Household[]; onClose: () => void }) {
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  return (
    <div class="modal" role="dialog" aria-label="QR handoff">
      <div class="modal-body">
        <div class="seg">
          <button class={mode === 'send' ? 'on' : ''} onClick={() => setMode('send')}>Show my records</button>
          <button class={mode === 'receive' ? 'on' : ''} onClick={() => setMode('receive')}>Scan a teammate</button>
        </div>
        {mode === 'send' ? <Send list={mine} /> : <Receive />}
        <button class="btn ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function Send({ list }: { list: Household[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { encodeFrames(list).then(setFrames); }, [list]);
  useEffect(() => {
    if (!frames.length) return;
    const t = setInterval(() => setI((x) => (x + 1) % frames.length), 700);
    return () => clearInterval(t);
  }, [frames]);
  useEffect(() => {
    if (canvas.current && frames[i]) QRCode.toCanvas(canvas.current, frames[i], { errorCorrectionLevel: 'L', width: 320, margin: 2 });
  }, [frames, i]);
  if (!list.length) return <p>You have no records to hand off yet.</p>;
  return (
    <div class="center">
      <p>{list.length} households · frame {i + 1}/{frames.length}</p>
      <canvas ref={canvas} />
      <p class="small muted">Hold steady until your teammate's phone says "complete". No network is used.</p>
    </div>
  );
}

function Receive() {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Starting camera…');
  const [done, setDone] = useState(0);

  useEffect(() => {
    const collector = new FrameCollector();
    let stream: MediaStream | null = null; let raf = 0; let stopped = false;
    const c = document.createElement('canvas'); const ctx = c.getContext('2d', { willReadFrequently: true })!;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        setStatus('Point at your teammate\'s QR code');
        const tick = async () => {
          if (stopped || !video.current) return;
          const v = video.current;
          if (v.videoWidth) {
            c.width = v.videoWidth; c.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
            if (code && collector.add(code.data)) setStatus(`Received ${collector.received}/${collector.total} frames`);
            if (collector.complete) {
              const list = await collector.households();
              for (const h of list) await saveHousehold(h);
              setDone(list.length); setStatus('Complete'); return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { setStatus(`Camera unavailable: ${(e as Error).message}`); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div class="center">
      <video ref={video} playsInline muted class="scan" />
      <p>{status}</p>
      {done > 0 && <p><b>{done} households</b> are now on this phone and will sync when you reach signal.</p>}
    </div>
  );
}
