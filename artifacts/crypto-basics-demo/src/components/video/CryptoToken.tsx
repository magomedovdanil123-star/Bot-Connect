export function CryptoToken({ className = '' }: { className?: string }) {
  return (
    <div className={`crypto-token ${className}`} aria-hidden="true">
      <div className="crypto-token__outer">
        <div className="crypto-token__inner">
          <div className="crypto-token__core">
            <span className="crypto-token__orbit crypto-token__orbit--one" />
            <span className="crypto-token__orbit crypto-token__orbit--two" />
            <span className="crypto-token__spark crypto-token__spark--one" />
            <span className="crypto-token__spark crypto-token__spark--two" />
            <span className="crypto-token__spark crypto-token__spark--three" />
          </div>
        </div>
      </div>
    </div>
  );
}