export interface ButtonOptions {
  disabled?: boolean;
  title?: string;
  className?: string;
  ariaLabel?: string;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export function makeButton(
  label: string,
  onClick: () => void,
  options: ButtonOptions = {}
): HTMLButtonElement {
  const button = element("button", options.className, label);
  button.type = "button";
  if (options.disabled) {
    button.disabled = true;
  }
  if (options.title) {
    button.title = options.title;
  }
  if (options.ariaLabel) {
    button.setAttribute("aria-label", options.ariaLabel);
  }
  button.addEventListener("click", onClick);
  return button;
}

export function makeProgress(value: number, label: string): HTMLProgressElement {
  const progress = element("progress");
  progress.max = 1;
  progress.value = Math.min(1, Math.max(0, value));
  progress.setAttribute("aria-label", label);
  return progress;
}

export function makeStatLine(label: string, value: number): HTMLParagraphElement {
  const line = element("p", "stat-line");
  line.append(element("span", "stat-label", label), element("span", "stat-value", `${Math.round(value)}`));
  return line;
}
