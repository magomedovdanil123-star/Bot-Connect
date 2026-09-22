import { listYoutubeConnections, updateYoutubeChannelBranding } from "../src/lib/youtube";

const renames = new Map<number, string>([
  [27, "Момент"],
  [28, "Суть"],
  [29, "Смысл"],
  [30, "Кадр"],
  [31, "Фокус"],
  [32, "Ракурс"],
  [33, "Пульс"],
  [34, "Точка"],
  [35, "Контекст"],
  [36, "Взгляд"],
  [37, "Сцена"],
  [38, "Мысль"],
  [39, "Случай"],
]);

const connections = await listYoutubeConnections();
const targetConnections = connections.filter((connection) => renames.has(connection.id));
if (targetConnections.length !== renames.size) {
  throw new Error(`Expected ${renames.size} target channels, found ${targetConnections.length}`);
}

for (const connection of [...targetConnections].sort((a, b) => a.id - b.id)) {
  const newTitle = renames.get(connection.id)!;
  const saved = await updateYoutubeChannelBranding(connection.id, { title: newTitle });
  console.log(`${connection.id}: ${connection.channelTitle || "(без названия)"} -> ${saved.title}`);
}