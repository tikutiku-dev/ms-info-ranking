"use strict";

const historyMessage = document.getElementById("history-message");
const historyContent = document.getElementById("history-content");

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`読み込み失敗: ${path}`);
  }

  return response.json();
}

async function initializeHistory() {
  try {
    const [config, players] = await Promise.all([
      loadJson("data/config.json"),
      loadJson("data/players.json"),
    ]);

    const currentSeason = Number(config.currentSeason);

    if (
      !Number.isInteger(currentSeason) ||
      currentSeason < 1
    ) {
      throw new Error("現在のシーズン設定が不正です。");
    }

    const playerMap = new Map(
      players.map((player) => [player.id, player])
    );

    const seasons = [];

    // 現在のシーズンより前を調べる
    for (let season = currentSeason - 1; season >= 1; season--) {
      try {
        const records = await loadJson(
          `data/season${season}.json`
        );

        if (Array.isArray(records) && records.length > 0) {
          seasons.push({
            season,
            ranking: createRanking(records, playerMap),
          });
        }
      } catch (error) {
        // データがないシーズンは表示しない
        console.info(`シーズン${season}のデータはありません。`);
      }
    }

    historyMessage.hidden = true;

    if (seasons.length === 0) {
      showMessage("現在、公開できる過去シーズンのランキングはありません。");
      return;
    }

    seasons.forEach(({ season, ranking }) => {
      historyContent.appendChild(
        createSeasonSection(season, ranking)
      );
    });
  } catch (error) {
    console.error("過去シーズンの読み込みに失敗しました:", error);
    showMessage(
      "過去シーズンを読み込めませんでした。データファイルを確認してください。"
    );
  }
}

function createRanking(records, playerMap) {
  const ranking = records
    .filter((record) => playerMap.has(record.playerId))
    .map((record) => ({
      ...record,
      player: playerMap.get(record.playerId),
    }));

  ranking.sort((a, b) => {
    if (a.difficulty !== b.difficulty) {
      return b.difficulty - a.difficulty;
    }

    return b.kills - a.kills;
  });

  let previousKey = null;
  let currentRank = 0;

  ranking.forEach((entry, index) => {
    const key = `${entry.difficulty}-${entry.kills}`;

    if (key !== previousKey) {
      currentRank = index + 1;
      previousKey = key;
    }

    entry.rank = currentRank;
  });

  return ranking;
}

function createSeasonSection(season, ranking) {
  const section = document.createElement("section");
  section.className = "season-section";

  const title = document.createElement("h2");
  title.textContent = `シーズン${season}`;

  const description = document.createElement("p");
  description.textContent = "最終ランキング";

  section.append(title, description);

  const list = document.createElement("div");
  list.className = "ranking-list";

  const heading = document.createElement("h3");
  heading.className = "ranking-list-title";
  heading.textContent = "ランキング";

  list.appendChild(heading);

  ranking.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "ranking-row";

    const position = document.createElement("span");
    position.className = "ranking-position";
    position.textContent = `${entry.rank}位`;

    const icon = document.createElement("img");
    icon.className = "ranking-icon";
    icon.alt = `${entry.player.name}のアイコン`;
    icon.loading = "lazy";
    icon.src =
      typeof entry.player.icon === "string"
        ? entry.player.icon
        : "";

    icon.addEventListener("error", () => {
      icon.style.visibility = "hidden";
    });

    const playerInfo = document.createElement("div");
    playerInfo.className = "ranking-player";

    const name = document.createElement("p");
    name.className = "ranking-name";
    name.textContent = entry.player.name;

    const difficulty = document.createElement("p");
    difficulty.className = "ranking-difficulty";
    difficulty.textContent = `難易度${entry.difficulty}`;

    playerInfo.append(name, difficulty);

    const score = document.createElement("div");
    score.className = "ranking-score";
    score.textContent = `${entry.kills}キル`;

    row.append(position, icon, playerInfo, score);
    list.appendChild(row);
  });

  section.appendChild(list);

  return section;
}

function showMessage(message) {
  historyMessage.textContent = message;
  historyMessage.hidden = false;
}

initializeHistory();