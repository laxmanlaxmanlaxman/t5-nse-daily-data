export default function Tip({ text, children }) {
  function hideTip(event) {
    const target = event.currentTarget.querySelector("a, button");
    if (target && typeof target.blur === "function") target.blur();
  }

  return (
    <span className="tip" onPointerDown={hideTip}>
      {children}
      <span className="tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
