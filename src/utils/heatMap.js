export function channelSegmentMatrix(rows) {
  const channelSet = new Set();
  const segmentSet = new Set();
  const cells = {};

  for (const r of rows) {
    const ch  = r.channel || '(outro)';
    const seg = r.segment || '(outro)';
    channelSet.add(ch);
    segmentSet.add(seg);
    const key = `${ch}||${seg}`;
    cells[key] = (cells[key] || 0) + (r.revenue || 0);
  }

  const channels = [...channelSet].sort((a, b) => {
    const totA = [...segmentSet].reduce((s, seg) => s + (cells[`${a}||${seg}`] || 0), 0);
    const totB = [...segmentSet].reduce((s, seg) => s + (cells[`${b}||${seg}`] || 0), 0);
    return totB - totA;
  });

  const segments = [...segmentSet].sort((a, b) => {
    const totA = channels.reduce((s, ch) => s + (cells[`${ch}||${a}`] || 0), 0);
    const totB = channels.reduce((s, ch) => s + (cells[`${ch}||${b}`] || 0), 0);
    return totB - totA;
  });

  const max = Math.max(...Object.values(cells), 1);

  return { channels, segments, cells, max };
}
