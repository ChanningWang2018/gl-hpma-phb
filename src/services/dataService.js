// Data Service - Handles data loading and processing logic
import { ThemeTokens } from "@/services/themeTokens.js";

export class DataService {
  // Avatar cache
  static avatarCache = {};

  // Prebuilt indexes over trends.rows, keyed by trends object identity so a
  // freshly loaded dataset (a new object on every load) always gets a fresh
  // index — stale rows can never be served after a reload.
  static rowIndexCache = new WeakMap();

  // Mode mapping (keep Chinese keys for data file compatibility)
  static modeMapping = {
    "1v1-low": "1v1:7500分以下",
    "1v1-high": "1v1:7500分以上",
    "2v2-low": "2v2:7500分以下",
    "2v2-high": "2v2:7500分以上",
  };

  // Get reverberation name
  static getReverberationName(id) {
    const names = {
      1: "Hermione Granger",
      2: "Harry Potter",
      3: "Dobby",
      4: "Rubeus Hagrid",
      5: "Weasley Twins",
      6: "Newt Scamander",
      7: "Severus Snape",
      8: "Neville Longbottom",
      9: "Bellatrix Lestrange",
      10: "Luna Lovegood",
      11: "Filius Flitwick",
      12: "Sirius Black",
      13: "Ron Weasley",
      14: "Ginny Weasley",
      15: "Albus Dumbledore",
      16: "Minerva McGonagall",
      17: "Lord Voldemort",
      18: "Cedric Diggory",
      19: "Gellert Grindelwald",
    };
    return names[id] || "Unknown Echo";
  }

  // 加载头像图片
  static loadAvatarImage(id) {
    return new Promise((resolve, reject) => {
      if (DataService.avatarCache[id]) {
        resolve(DataService.avatarCache[id]);
        return;
      }

      const img = new Image();
      const idStr = id.toString().padStart(2, "0");
      
      img.onload = function () {
        DataService.avatarCache[id] = img;
        resolve(img);
      };
      
      img.onerror = function () {
        console.error("Failed to load avatar image:", id);
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = ThemeTokens.tokens.colors.inkFaded;
        ctx.beginPath();
        ctx.arc(20, 20, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(id, 20, 20);
        DataService.avatarCache[id] = canvas;
        resolve(canvas);
      };
      
      img.src = `/images/avatars/echo${idStr}.webp`;
    });
  }

  // 加载聚合趋势数据（单请求替代逐个加载全部归档文件）
  static async loadTrendsData() {
    const response = await fetch("/archive/trends.json");
    if (!response.ok) {
      throw new Error("Failed to load trends data: HTTP " + response.status);
    }
    return response.json();
  }

  static resolveModeIndex(trends, mode) {
    return trends.modes.indexOf(DataService.modeMapping[mode]);
  }

  // 构建并缓存 trends.rows 索引（懒加载，一次性 O(rows)）：
  // - byRow: "periodIndex|echoId|modeIndex" -> row（重复 key 保留首行，与 find 语义一致）
  // - byPeriodMode: "periodIndex|modeIndex" -> rows[]（保留原始行序，供散点提取使用）
  static getRowIndex(trends) {
    let index = DataService.rowIndexCache.get(trends);
    if (!index) {
      const byRow = new Map();
      const byPeriodMode = new Map();
      for (const row of trends.rows) {
        const rowKey = `${row[0]}|${row[1]}|${row[2]}`;
        if (!byRow.has(rowKey)) {
          byRow.set(rowKey, row);
        }
        const groupKey = `${row[0]}|${row[2]}`;
        let group = byPeriodMode.get(groupKey);
        if (!group) {
          group = [];
          byPeriodMode.set(groupKey, group);
        }
        group.push(row);
      }
      index = { byRow, byPeriodMode };
      DataService.rowIndexCache.set(trends, index);
    }
    return index;
  }

  // 提取特定回响和模式的数据（trends.rows: [periodIndex, echoId, modeIndex, winrate, pickrate]）
  static extractData(trends, reverberationId, mode) {
    if (!trends) return [];
    const modeIndex = DataService.resolveModeIndex(trends, mode);
    const echoId = parseInt(reverberationId);
    const { byRow } = DataService.getRowIndex(trends);
    return trends.periods.map((period, periodIndex) => {
      const row = byRow.get(`${periodIndex}|${echoId}|${modeIndex}`);
      return {
        period,
        winrate: row ? row[3] : null,
        attendancerate: row ? row[4] : null,
      };
    });
  }

  // 提取散点图数据
  static extractScatterData(trends, period, mode) {
    if (!trends) return [];
    const periodIndex = trends.periods.indexOf(period);
    const modeIndex = DataService.resolveModeIndex(trends, mode);
    if (periodIndex === -1 || modeIndex === -1) return [];

    const rows = DataService.getRowIndex(trends).byPeriodMode.get(
      `${periodIndex}|${modeIndex}`
    );
    // Copy before sort: the grouped arrays are shared cache state
    return (rows ? [...rows] : [])
      .sort((a, b) => a[1] - b[1])
      .map((r) => ({
        reverberationid: r[1],
        winrate: r[3],
        attendancerate: r[4],
        name: DataService.getReverberationName(r[1]),
      }));
  }
}
