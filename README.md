# Harry Potter Card Game Analytics Dashboard

A Vue 3-based analytics dashboard for tracking character (Reverberation, Echo) performance metrics in Harry Potter: Magic Awakened. The application visualizes win rates, attendance rates, and statistical distributions across different game modes.

## 📊 Features

- **Interactive Scatter Charts**: Visualize character performance by plotting attendance rate vs win rate
- **Trend Analysis**: Track win rate and attendance rate trends over time with line charts
- **Filterable Data**: Filter data by:
  - Character (Reverberation) selection
  - Game mode (1v1 or 2v2, low or high rank brackets)
  - Time periods
- **Comprehensive Data Tables**: Detailed statistics with sortable columns
- **Real-time Analytics**: Dynamic chart updates based on selected filters
- **Character Data**: Complete mapping of 18 Harry Potter characters with avatar images

## 🛠️ Technology Stack

- **Frontend Framework**: Vue 3 (^3.5.26)
- **Build Tool**: Vite (^7.3.0)
- **State Management**: Pinia (^3.0.4)
- **Charting**: Chart.js (^4.5.1) with vue-chartjs (^5.3.3)
- **Node.js**: ^20.19.0 || >=22.12.0

## 📁 Project Structure

```
├── src/
│   ├── App.vue                 # Main application component
│   ├── main.js                 # Application entry point
│   ├── assets/
│   │   └── styles/
│   │       └── global.css      # Global styling
│   ├── components/
│   │   ├── Header.vue          # Page header
│   │   ├── Controls.vue        # Filter and control panel (Mode + Period)
│   │   ├── EchoSelect.vue      # Character selection for trend charts
│   │   ├── ChartWrapper.vue    # Reusable chart container
│   │   ├── ScatterChart.vue    # Attendance vs Win rate scatter plot
│   │   ├── LineChart.vue       # Trend line charts
│   │   └── DataTable.vue       # Statistics table
│   ├── services/
│   │   ├── dataService.js      # Data loading and transformation
│   │   └── chartService.js     # Chart configuration
│   ├── stores/
│   │   └── chartStore.js       # Pinia state store
│   ├── composables/            # Vue composables (if any)
│   └── utils/                  # Utility functions
├── public/
│   ├── images/
│   │   └── avatars/            # Character avatar images
│   └── archive/                # Historical data snapshots
├── vite.config.js              # Vite configuration
├── jsconfig.json               # JavaScript configuration
├── package.json                # Project dependencies
├── index.html                  # HTML entry point
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js ^20.19.0 or >=22.12.0
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gl-hpma-phb
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Build for Production

Create an optimized production build:
```bash
npm run build
```

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## 📊 Supported Characters (Reverberations)

1. Hermione Granger (赫敏·格兰杰)
2. Harry Potter (哈利·波特)
3. Dobby (多比)
4. Rubeus Hagrid (鲁伯·海格)
5. Weasley Twins (韦斯莱双胞胎)
6. Newt Scamander (纽特·斯卡曼德)
7. Severus Snape (西弗勒斯·斯内普)
8. Neville Longbottom (纳威·隆巴顿)
9. Bellatrix Lestrange (贝拉·莱斯特兰奇)
10. Luna Lovegood (卢娜·洛夫古德)
11. Filius Flitwick (菲利乌斯·弗立维)
12. Sirius Black (小天狼星·布莱克)
13. Ron Weasley (罗恩·韦斯莱)
14. Ginny Weasley (金妮·韦斯莱)
15. Albus Dumbledore (阿不思·邓布利多)
16. Minerva McGonagall (米勒娃·麦格)
17. Voldemort (伏地魔)
18. Cedric Diggory (塞德里克·迪戈里)

## 🎮 Game Modes

The dashboard supports four game modes:
- **1v1 Low**: 1v1 matches with ratings below 7500
- **1v1 High**: 1v1 matches with ratings 7500 and above
- **2v2 Low**: 2v2 matches with ratings below 7500
- **2v2 High**: 2v2 matches with ratings 7500 and above

## 📈 Key Metrics

- **Win Rate**: Percentage of matches won with a character in a given period
- **Attendance Rate**: Percentage of matches a character was used in a given period
- **Pick Rate**: Number of times a character was selected
- **Ban Rate**: Number of times a character was banned

## 💾 Data Storage

- Historical data snapshots are stored in the `public/archive` directory and accessible at `/archive` URL path
- Data files include timestamps for version tracking
- Current working data is in `snapshot.json`

## 📝 License

See [LICENSE](LICENSE) file for details.

## 🔧 Configuration

### Vite Configuration
- Vue 3 plugin enabled for Single File Component support
- Path alias: `@` points to `./src` directory
- Vue DevTools integration for debugging

### Chart Configuration
- Responsive chart sizing
- Real-time data updates on filter changes
- Customizable colors and styling per chart

## 🤝 Contributing

When contributing to this project:

1. Maintain the existing component structure
2. Use Vue 3 Composition API
3. Keep components modular and reusable
4. Update data when adding new characters or game modes

## 📝 Notes

- The application is primarily configured for Chinese language display
- Character names and game modes follow Harry Potter universe terminology
- All time periods are tracked for historical analysis

---

**Last Updated**: January 14, 2026
