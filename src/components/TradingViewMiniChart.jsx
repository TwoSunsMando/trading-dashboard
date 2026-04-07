import { useEffect, useRef, memo } from "react";

function TradingViewMiniChart({ symbol = "NASDAQ:AAPL", width = "100%", height = 160, dateRange = "1M" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: typeof width === "number" ? width : "100%",
      height,
      locale: "en",
      dateRange,
      colorTheme: "dark",
      isTransparent: true,
      autosize: typeof width !== "number",
      noTimeScale: true,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, width, height, dateRange]);

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height, width }}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

export default memo(TradingViewMiniChart);
