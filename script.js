"use strict";

/* =========================
   基本設定
========================= */

const DATA_DIRECTORY = "data";

const elements = {
  seasonTitle: document.getElementById("season-title"),
  seasonDescription: document.getElementById("season-description"),
  rankingMessage: document.getElementById("ranking-message"),
  topThree: document.getElementById("top-three"),
  rankingList: document.getElementById("ranking-list"),
  historyNavigation: document.getElementById("history-navigation"),
};

/* =========================
   JSON読み込み
========================= */

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `ファイルを読み込めませんでした: ${path} (${response.status})`
    );
  }

  return response.json();
}

/* =========================
   初期化
========================= */

async function initializeRanking() {
  try {
    const config = await loadJson(
      `${DATA_DIRECTORY}/config.json`
    );

    const currentSeason = Number(config.currentSeason);

    if (
      !Number.isInteger(currentSeason) ||
      currentSeason < 1
    ) {
      throw new Error("config.jsonのcurrentSeasonが不正です。");
    }

    const [players, records] = await Promise.all([
      loadJson(`${DATA_DIRECTORY}/players.json`),
      loadJson(
        `${DATA_DIRECTORY}/season${currentSeason}.json`
      ),
    ]);

    validateData(players, records);

    const playerMap = new Map(
      players.map((player) => [player.id, player])
    );

    const ranking = createRanking(records, playerMap);

    renderSeason(currentSeason);
    renderRanking(ranking);

    renderHistoryLinks(currentSeason);

    if (ranking.length === 0) {
      showMessage("まだランキングの記録がありません。");
    } else {
      elements.rankingMessage.hidden = true;
    }
  } catch (error) {
    console.error("ランキングの読み込みに失敗しました:", error);

    showMessage(
      "ランキングを読み込めませんでした。データファイルや設定を確認してください。"
    );
  }
}

/* =========================
   データの検証
========================= */

function validateData(players, records) {
  if (!Array.isArray(players) || !Array.isArray(records)) {
    throw new Error("JSONの形式が正しくありません。");
  }

  const playerIds = new Set();

  for (const player of players) {
    if (
      !player ||
      typeof player.id !== "string" ||
      typeof player.name !== "string"
    ) {
      throw new Error("players.jsonのデータが不正です。");
    }

    if (playerIds.has(player.id)) {
      throw new Error(`プレイヤーIDが重複しています: ${player.id}`);
    }

    playerIds.add(player.id);
  }

  const recordedPlayerIds = new Set();

  for (const record of records) {
    if (
      !record ||
      typeof record.playerId !== "string" ||
      !Number.isInteger(record.difficulty) ||
      record.difficulty < 1 ||
      record.difficulty > 4 ||
      !Number.isInteger(record.kills) ||
      record.kills < 0 ||
      record.kills > 750
    ) {
      throw new Error("戦績データに不正な値があります。");
    }

    if (recordedPlayerIds.has(record.playerId)) {
      throw new Error(
        `同じプレイヤーの記録が重複しています: ${record.playerId}`
      );
    }

    recordedPlayerIds.add(record.playerId);
  }
}

/* =========================
   ランキング作成
========================= */

function createRanking(records, playerMap) {
  const ranking = records
    .filter((record) => {
      if (!playerMap.has(record.playerId)) {
        console.warn(
          `登録されていないプレイヤーIDです: ${record.playerId}`
        );
        return false;
      }

      return true;
    })
    .map((record) => ({
      ...record,
      player: playerMap.get(record.playerId),
    }));

  // 難易度が高い人を優先し、
  // 同じ難易度ならキル数が多い人を優先する。
  ranking.sort((a, b) => {
    if (a.difficulty !== b.difficulty) {
      return b.difficulty - a.difficulty;
    }

    return b.kills - a.kills;
  });

  // 難易度とキル数が同じなら同率順位。
  // 例：1位、2位、2位、4位
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

/* =========================
   シーズン表示
========================= */

function renderSeason(season) {
  const seasonImage = document.getElementById("season-image");

  if (seasonImage) {
    seasonImage.src = `images/season${season}.jpg`;
    seasonImage.alt = `シーズン${season}`;
  }
}

/* =========================
   ランキング表示
========================= */


function renderRanking(ranking) {
  elements.topThree.replaceChildren();
  elements.rankingList.replaceChildren();

  // 全員を横長のランキングリストで表示する
  elements.topThree.hidden = true;

  if (ranking.length === 0) {
    elements.rankingList.hidden = true;
    return;
  }

  ranking.forEach((entry) => {
    elements.rankingList.appendChild(
      createRankingRow(entry)
    );
  });

  elements.rankingList.hidden = false;
}

/* =========================
   4位以下のランキング行
========================= */



function createRankingRow(entry) {
  const row = document.createElement("article");
  row.className = `ranking-row rank-row-${entry.rank}`;

  const position = document.createElement("span");
  position.className = "ranking-position";

  // 上位3人には特別なマークを付ける
  if (entry.rank === 1) {
    position.textContent = "👑";
    position.setAttribute("aria-label", "1位");
  } else if (entry.rank === 2) {
    position.textContent = "🥈";
    position.setAttribute("aria-label", "2位");
  } else if (entry.rank === 3) {
    position.textContent = "🥉";
    position.setAttribute("aria-label", "3位");
  } else {
    position.textContent = `${entry.rank}`;
  }

  const icon = createPlayerIcon(
    entry.player,
    "ranking-icon"
  );

  const playerInfo = document.createElement("div");
  playerInfo.className = "ranking-player";

  const name = document.createElement("p");
  name.className = "ranking-name";
  name.textContent = entry.player.name;

  playerInfo.appendChild(name);

  // キル数
  const score = document.createElement("div");
  score.className = "ranking-score";
  score.append(
    document.createTextNode(
      entry.kills.toLocaleString("ja-JP")
    )
  );

  const scoreLabel = document.createElement("small");
  scoreLabel.textContent = "キル";
  score.appendChild(scoreLabel);

  // 難易度（D1～D4）
  const difficulty = document.createElement("span");
  difficulty.className = "ranking-difficulty";
  difficulty.textContent = `D${entry.difficulty}`;

  row.append(position, icon, playerInfo, score, difficulty);

  return row;
}

/* =========================
   プレイヤーアイコン
========================= */

function createPlayerIcon(player, className) {
  const icon = document.createElement("img");

  icon.className = className;
  icon.alt = `${player.name}のアイコン`;
  icon.loading = "lazy";

  // 画像が指定されていれば、その画像を使用する。
  // 画像がない場合や読み込みに失敗した場合は、
  // 汎用のアイコン表示に切り替える。
  icon.src =
    typeof player.icon === "string" && player.icon.trim()
      ? player.icon
      : createFallbackIcon();

  icon.addEventListener("error", () => {
    if (icon.dataset.fallbackApplied === "true") {
      return;
    }

    icon.dataset.fallbackApplied = "true";
    icon.src = createFallbackIcon();
  });

  return icon;
}

function createFallbackIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="50" fill="#edf0f5"/>
      <circle cx="50" cy="36" r="19" fill="#a5adba"/>
      <path d="M16 94c2-22 16-34 34-34s32 12 34 34" fill="#a5adba"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/* =========================
   メッセージ表示
========================= */

function showMessage(message) {
  elements.rankingMessage.textContent = message;
  elements.rankingMessage.hidden = false;
  elements.topThree.hidden = true;
  elements.rankingList.hidden = true;
}

/* =========================
   実行
========================= */

/* =========================
   過去シーズンへのリンク
========================= */

function renderHistoryLinks(currentSeason) {
  const navigation = elements.historyNavigation;
  navigation.replaceChildren();

  for (let season = currentSeason - 1; season >= 2; season--) {
    const link = document.createElement("a");
    link.href = `season${season}.html`;
    link.textContent = `シーズン${season}のランキングを見る`;

    navigation.appendChild(link);
  }

  navigation.hidden = navigation.childElementCount === 0;
}

initializeRanking();