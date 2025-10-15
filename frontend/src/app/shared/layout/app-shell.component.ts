import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule
  ],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent implements OnInit {
  isHandicap = false;
  isAdmin = false;
  userName?: string;
  isDark = false;
  currentFragment: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.isAdmin = user?.role === 'admin';
    this.isHandicap = user?.role === 'handicap';
    this.userName = user?.prenom || user?.email || 'Utilisateur';

    // Initialize theme from storage or system preference
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      this.setTheme(true);
    } else {
      this.setTheme(false);
    }

    // Track fragment for active nav highlighting
    const setFragment = () => {
      const tree = this.router.parseUrl(this.router.url);
      this.currentFragment = tree.fragment || null;
    };
    setFragment();
    this.router.events.subscribe(ev => {
      if (ev instanceof NavigationEnd) {
        setFragment();
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }

  toggleTheme(): void {
    this.setTheme(!this.isDark);
  }

  private setTheme(dark: boolean): void {
    this.isDark = dark;
    const root = document.documentElement;
    if (dark) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }
}
