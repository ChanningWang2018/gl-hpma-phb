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

  // 加载清单文件
  static async loadManifest() {
    try {
      const response = await fetch("/archive/manifest.json");
      const manifest = await response.json();
      const files = manifest.files.map((file) => ({
        period: file.period,
        file: "/archive/" + file.file,
      }));

      // 按时间排序，最旧的在前
      files.sort((a, b) => {
        return (
          new Date(a.period.split(" - ")[0]) -
          new Date(b.period.split(" - ")[0])
        );
      });

      return files;
    } catch (error) {
      console.error("Error loading manifest:", error);
      return [];
    }
  }

  // 加载所有归档数据
  static async loadArchiveData() {
    const archiveFiles = await DataService.loadManifest();
    const dataPromises = archiveFiles.map(async (item) => {
      try {
        const response = await fetch(item.file);
        const json = await response.json();
        return {
          period: item.period,
          data: json.data.huixianginfo,
        };
      } catch (error) {
        console.error("Error loading " + item.file + ":", error);
        return null;
      }
    });

    const results = await Promise.all(dataPromises);
    return results.filter((r) => r !== null);
  }

  // 提取特定回响和模式的数据
  static extractData(loadedData, reverberationId, mode) {
    return loadedData.map((item) => {
      const record = item.data.find(
        (d) =>
          d.reverberationid === parseInt(reverberationId) &&
          d.type === DataService.modeMapping[mode]
      );
      return {
        period: item.period,
        winrate: record ? record.winrate : null,
        attendancerate: record ? record.attendancerate : null,
      };
    });
  }

  // 提取散点图数据
  static extractScatterData(loadedData, period, mode) {
    const periodData = loadedData.find((item) => item.period === period);

    if (!periodData) return [];

    const validIds = [...new Set(periodData.data.map(d => d.reverberationid))].sort((a, b) => a - b);
    const scatterData = [];
    for (const i of validIds) {
      const record = periodData.data.find(
        (d) =>
          d.reverberationid === i && d.type === DataService.modeMapping[mode]
      );
      if (record) {
        scatterData.push({
          reverberationid: i,
          winrate: record.winrate,
          attendancerate: record.attendancerate,
          name: DataService.getReverberationName(i),
        });
      }
    }
    return scatterData;
  }
}
