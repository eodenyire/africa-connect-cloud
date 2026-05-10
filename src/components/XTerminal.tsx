import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

interface XTerminalProps {
  /** WebSocket relay URL. If omitted, terminal runs in offline demo mode. */
  wsUrl?: string;
  /** Banner printed before the connection attempt. */
  banner?: string;
}

/**
 * Real xterm.js terminal. Connects to a WebSocket relay (e.g. ttyd, wetty,
 * Apache Guacamole, or a custom Deno/Node SSH bridge) when wsUrl is provided.
 * The relay is expected to speak raw bytes both ways — same protocol ttyd uses.
 */
export const XTerminal = ({ wsUrl, banner }: XTerminalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
      fontSize: 13,
      theme: {
        background: "#0A0F1A",
        foreground: "#E5E7EB",
        cursor: "#F59E0B",
        selectionBackground: "#F59E0B33",
      },
      cursorBlink: true,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    if (banner) banner.split("\n").forEach((l) => term.writeln(l));

    if (wsUrl) {
      term.writeln(`\x1b[36mConnecting to ${wsUrl}…\x1b[0m`);
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.binaryType = "arraybuffer";
        ws.onopen = () => term.writeln("\x1b[32m✓ Connected\x1b[0m");
        ws.onmessage = (ev) => {
          if (typeof ev.data === "string") term.write(ev.data);
          else term.write(new Uint8Array(ev.data) as any);
        };
        ws.onerror = () => term.writeln("\x1b[31m✗ Relay error\x1b[0m");
        ws.onclose = () => term.writeln("\x1b[33m• Connection closed\x1b[0m");
        term.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(d));
      } catch (e) {
        term.writeln(`\x1b[31m✗ ${(e as Error).message}\x1b[0m`);
      }
    } else {
      term.writeln("");
      term.writeln("\x1b[33m⚠ No terminal relay configured.\x1b[0m");
      term.writeln("\x1b[2mSet VITE_TERMINAL_RELAY_URL or run ttyd on the VM:\x1b[0m");
      term.writeln("\x1b[2m  ssh user@vm 'ttyd -p 7681 bash'\x1b[0m");
      term.writeln("\x1b[2mThen point this UI at ws://vm-ip:7681/ws\x1b[0m");
      term.writeln("");
      term.write("$ ");
      let buf = "";
      term.onData((d) => {
        if (d === "\r") {
          term.writeln("");
          if (buf.trim()) term.writeln(`\x1b[2m(offline) command not executed: ${buf}\x1b[0m`);
          buf = "";
          term.write("$ ");
        } else if (d === "\u007F") {
          if (buf.length) { buf = buf.slice(0, -1); term.write("\b \b"); }
        } else {
          buf += d; term.write(d);
        }
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      wsRef.current?.close();
      term.dispose();
    };
  }, [wsUrl, banner]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-md overflow-hidden bg-[#0A0F1A] p-2" />;
};
