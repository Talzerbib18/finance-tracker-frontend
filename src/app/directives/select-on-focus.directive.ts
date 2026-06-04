import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: 'input[type="number"]',
  standalone: true
})
export class SelectOnFocusDirective {
  @HostListener('focus', ['$event.target'])
  onFocus(input: HTMLInputElement) {
    setTimeout(() => input.select(), 0);
  }
}
