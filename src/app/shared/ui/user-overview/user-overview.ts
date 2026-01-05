import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-user-overview',
  imports: [],
  templateUrl: './user-overview.html',
  styleUrl: './user-overview.css',
})
export class UserOverview {

  user = input.required<any>(); 
  logout = output<void>();

  isDropdownOpen = signal(false);

  toggleDropdown() {
    this.isDropdownOpen.update(v => !v);
  }

  handleLogout() {
    this.isDropdownOpen.set(false);
    this.logout.emit();
  }
}
