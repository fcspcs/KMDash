<script>
  // Line icons in Lucide style (24px grid, fine 1.6px stroke)
  const PATHS = {
    measure: 'M22 12h-4l-3 9L9 3l-3 9H2',
    overview: 'M3 3v18h18 M7 14l4-4 4 4 5-6',
    table: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
    project: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z',
    left: 'm15 18-6-6 6-6',
    right: 'm9 18 6-6-6-6',
    down: 'm6 9 6 6 6-6',
    check: 'M20 6 9 17l-5-5',
    close: 'M18 6 6 18M6 6l12 12',
    warn: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01',
    info: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z M12 16v-4 M12 8h.01',
    undo: 'M3 7v6h6 M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13',
    repeat: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5',
    play: 'M6 3l14 9-14 9V3z',
    stop: 'M6 6h12v12H6z',
    skip: 'M5 4l10 8-10 8V4z M19 5v14',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    plus: 'M12 5v14 M5 12h14',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
    target: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12Z M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4Z',
    bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    external: 'M15 3h6v6 M10 14 21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    wifi: 'M5 12.55a11 11 0 0 1 14.08 0 M1.42 9a16 16 0 0 1 21.16 0 M8.53 16.11a6 6 0 0 1 6.95 0 M12 20h.01',
    sound: 'M11 5 6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
    list: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    compare: 'M8 3 4 7l4 4 M4 7h16 M16 21l4-4-4-4 M20 17H4',
    layers: 'M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5',
    globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    piano: 'M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8 M2 14h20 M6 14v4 M10 14v4 M14 14v4 M18 14v4',
    minus: 'M5 12h14',
    crosshair: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z M22 12h-4 M6 12H2 M12 6V2 M12 22v-4',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5',
    share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13',
    note: 'M9 18V5l12-2v13 M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z M18 13a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z',
  };

  let { name, size = 20, stroke = 1.6 } = $props();
</script>

<svg class="i i-{name}" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={PATHS[name]} />
</svg>
