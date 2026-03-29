import { LitElement, html, css, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('scrollout-logo')
export class ScrolloutLogo extends LitElement {
  static styles = css`
    :host { display: inline-flex; align-items: center; justify-content: center; }
  `;

  @property({ type: Number }) size = 28;

  render() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg"
        width="${this.size}" height="${this.size}"
        viewBox="0 0 540 540" fill="none" aria-hidden="true">
        ${svg`
          <path fill="var(--white)" fill-opacity="0.9"
            d="M375.996,269.424C376.38,331.49 345.296,379.381 270.465,378.998C189.877,378.615 163.781,334.938 163.014,269.807C162.246,207.741 193.33,161 269.697,161C344.913,161 375.613,208.124 375.996,269.424ZM309.224,269.424C309.224,239.157 299.63,213.105 270.465,213.488C237.846,213.871 229.403,239.157 229.403,270.19C229.403,301.607 238.613,326.893 270.465,326.51C299.63,326.127 309.607,300.84 309.224,269.424Z"/>
          <circle cx="375.316" cy="167.053" r="23.684" fill="#8C43E9"/>
          <circle cx="339.316" cy="144.316" r="12.316" fill="#FF6701"/>
        `}
      </svg>
    `;
  }
}
