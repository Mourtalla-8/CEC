import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { NgApexchartsModule } from 'ng-apexcharts';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexPlotOptions,
  ApexFill,
  ApexLegend,
  ApexResponsive,
  ApexTooltip,
  ApexStroke,
  ApexYAxis
} from 'ng-apexcharts';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
  <div class="charts-grid" role="region" aria-label="Statistiques des demandes">
    <apx-chart
      [series]="barSeries"
      [chart]="barChart"
      [xaxis]="barXAxis"
      [dataLabels]="barDataLabels"
      [plotOptions]="barPlotOptions"
      [colors]="chartColors"
      [fill]="fill"
      [states]="states"
      [stroke]="barStroke"
      [yaxis]="barYAxis"
      [tooltip]="tooltip"
      [responsive]="responsive"
      class="chart-card">
    </apx-chart>

    <apx-chart
      [series]="donutSeries"
      [chart]="donutChart"
      [labels]="donutLabels"
      [colors]="chartColors"
      [fill]="fill"
      [states]="states"
      [stroke]="barStroke"
      [legend]="legend"
      [responsive]="responsive"
      class="chart-card">
    </apx-chart>
  </div>
  `,
  styles: [`
    .charts-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
    .chart-card { background: #fff; border-radius: 8px; box-shadow: var(--shadow-light); padding: 8px; }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }

    /* Dim non-hovered segments on hover, keep hovered unchanged */
    .chart-card .apexcharts-canvas:hover .apexcharts-series path,
    .chart-card .apexcharts-canvas:hover .apexcharts-series rect {
      opacity: 0.35;
      transition: opacity 120ms ease-in-out;
    }
    .chart-card .apexcharts-canvas .apexcharts-series path:hover,
    .chart-card .apexcharts-canvas .apexcharts-series rect:hover {
      opacity: 1;
    }
  `]
})
export class AdminStatsComponent implements OnChanges {
  @Input() stats: { total: number; enAttente: number; enCours: number; validees: number; rejetees: number } = {
    total: 0, enAttente: 0, enCours: 0, validees: 0, rejetees: 0
  };

  barSeries: ApexAxisChartSeries = [];
  barChart: ApexChart = { type: 'bar', height: 300, toolbar: { show: false } };
  barXAxis: ApexXAxis = { categories: ['En attente', 'En cours', 'Validées', 'Rejetées'] };
  barDataLabels: ApexDataLabels = { enabled: false };
  barPlotOptions: ApexPlotOptions = { bar: { distributed: true, columnWidth: '50%', borderRadius: 4 } };
  barStroke: ApexStroke = { show: false, width: 0, colors: ['transparent'] };
  barYAxis: ApexYAxis = { title: { text: 'Nombre' } };

  donutSeries: number[] = [];
  donutLabels: string[] = ['En attente', 'En cours', 'Validées', 'Rejetées'];
  donutChart: ApexChart = { type: 'donut', height: 300 };
  legend: ApexLegend = { position: 'bottom' };
  tooltip: ApexTooltip = { theme: 'light' };
  responsive: ApexResponsive[] = [{ breakpoint: 768, options: { legend: { position: 'bottom' } } }];

  // Status colors aligned with chips (slightly darker tints for better visibility): en_attente, en_cours_traitement, validee, rejetee
  chartColors: string[] = ['#FFD774', '#BBDEFB', '#A5D6A7', '#EF9A9A'];

  // High opacity; do not alter hovered color via filters (CSS dims others)
  fill: ApexFill = { opacity: 0.95 };
  states = { hover: { filter: { type: 'none' as const } }, active: { filter: { type: 'none' as const } } };

  ngOnChanges(_: SimpleChanges): void {
    const { enAttente, enCours, validees, rejetees } = this.stats || ({} as any);
    this.barSeries = [{
      name: 'Demandes',
      data: [enAttente || 0, enCours || 0, validees || 0, rejetees || 0]
    }];
    this.donutSeries = [enAttente || 0, enCours || 0, validees || 0, rejetees || 0];
  }
}
