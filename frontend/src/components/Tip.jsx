export default function Tip({ text, children }) {
  return (
    <span className="tip">
      {children}
      <span className="tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
