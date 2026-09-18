// Data Service - Handles data loading and processing logic
export class DataService {
  // Avatar cache
  static avatarCache = {};

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
        ctx.fillStyle = "#667eea";
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

  // 提取特定回响和模式的数据（trends.rows: [periodIndex, echoId, modeIndex, winrate, pickrate]）
  static extractData(trends, reverberationId, mode) {
    if (!trends) return [];
    const modeIndex = DataService.resolveModeIndex(trends, mode);
    const echoId = parseInt(reverberationId);
    return trends.periods.map((period, periodIndex) => {
      const row = trends.rows.find(
        (r) => r[0] === periodIndex && r[1] === echoId && r[2] === modeIndex
      );
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

    return trends.rows
      .filter((r) => r[0] === periodIndex && r[2] === modeIndex)
      .sort((a, b) => a[1] - b[1])
      .map((r) => ({
        reverberationid: r[1],
        winrate: r[3],
        attendancerate: r[4],
        name: DataService.getReverberationName(r[1]),
      }));
  }
}
