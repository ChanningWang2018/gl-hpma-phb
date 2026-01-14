// Chart Service - Handles chart configuration and generation
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScatterController,
  zoomPlugin
);

export class ChartService {
  // Create scatter chart
  static async createScatterChart(ctx, data, avatarCache) {
    // Preload all avatar images
    const avatarPromises = data.map((item) =>
      this.loadAvatarImage(item.reverberationid, avatarCache)
    );
    await Promise.all(avatarPromises);

    const chart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Echo Distribution",
            data: data.map((item) => ({
              x: item.attendancerate,
              y: item.winrate,
              reverberationid: item.reverberationid,
              name: item.name,
            })),
            backgroundColor: "rgba(102, 126, 234, 0.3)",
            borderColor: "rgba(102, 126, 234, 0.8)",
            borderWidth: 1,
            pointRadius: 25,
            pointHoverRadius: 30,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: {
              size: 14,
              weight: "600",
            },
            bodyFont: {
              size: 13,
            },
            callbacks: {
              label: function (context) {
                const item = data[context.dataIndex];
                return [
                  item.name,
                  `Win Rate: ${item.winrate.toFixed(2)}%`,
                  `Pick Rate: ${item.attendancerate.toFixed(2)}%`,
                ];
              },
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: "xy",
              modifierKey: "ctrl",
            },
            zoom: {
              wheel: {
                enabled: true,
                modifierKey: "ctrl",
              },
              pinch: {
                enabled: true,
              },
              mode: "xy",
            },
          },
        },
        scales: {
          y: {
            title: {
              display: true,
              text: "Win Rate (%)",
              font: {
                size: 14,
                weight: "600",
              },
              color: "#495057",
            },
            beginAtZero: false,
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              callback: function (value) {
                return value + "%";
              },
              font: {
                size: 12,
              },
            },
          },
          x: {
            title: {
              display: true,
              text: "Pick Rate (%)",
              font: {
                size: 14,
                weight: "600",
              },
              color: "#495057",
            },
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              callback: function (value) {
                return value + "%";
              },
              font: {
                size: 12,
              },
            },
          },
        },
        interaction: {
          intersect: true,
          mode: "point",
        },
      },
    });

    // 自定义绘制头像
    chart.draw = function () {
      Chart.prototype.draw.call(this);

      const ctx = this.ctx;
      const meta = this.getDatasetMeta(0);

      meta.data.forEach((point, index) => {
        const x = point.x;
        const y = point.y;
        const avatar = avatarCache[data[index].reverberationid];

        if (avatar) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          ctx.drawImage(avatar, x - 20, y - 20, 40, 40);

          ctx.restore();

          // 添加边框
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(102, 126, 234, 0.8)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    };

    return chart;
  }

  // 创建折线图
  static createLineChart(ctx, label, data, color) {
    return new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((d) => d.period),
        datasets: [
          {
            label: label,
            data: data.map((d) => d.value),
            borderColor: color,
            backgroundColor: color
              .replace(")", ", 0.1)")
              .replace("rgb", "rgba"),
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: "white",
            pointBorderColor: color,
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              font: {
                size: 14,
                weight: "600",
              },
            },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: 12,
            titleFont: {
              size: 14,
              weight: "600",
            },
            bodyFont: {
              size: 13,
            },
            callbacks: {
              label: function (context) {
                return `${label}: ${context.parsed.y.toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: label.includes("Pick Rate") ? true : false,
            min: label.includes("Win Rate") ? 30 : undefined,
            max: label.includes("Win Rate") ? 70 : undefined,
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              callback: function (value) {
                return value + "%";
              },
              font: {
                size: 12,
              },
            },
          },
          x: {
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              font: {
                size: 12,
              },
            },
          },
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
      },
    });
  }

  // 加载头像图片
  static loadAvatarImage(id, avatarCache) {
    return new Promise((resolve, reject) => {
      // 检查缓存
      if (avatarCache[id]) {
        resolve(avatarCache[id]);
        return;
      }

      const img = new Image();
      img.onload = function () {
        avatarCache[id] = img;
        resolve(img);
      };
      img.onerror = function () {
        console.error("Failed to load avatar image:", id);
        // 创建一个简单的圆形作为fallback
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
        avatarCache[id] = canvas;
        resolve(canvas);
      };
      // 修复图片路径 - 在Vite中，public目录下的文件直接使用根路径访问
      img.src = `/images/avatars/echo${id.toString().padStart(2, "0")}.png`;
    });
  }
}
