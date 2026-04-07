import { useEffect, useRef, memo } from "react";

function TradingViewChart({ symbol = "NASDAQ:AAPL", interval = "D", height = 500, studies = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      interval,
      theme: "dark",
      style: "1",
      width: "100%",
      height,
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      studies,
      backgroundColor: "rgba(0, 0, 0, 0)",
      gridColor: "rgba(70, 50, 120, 0.15)",
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, interval, height, JSON.stringify(studies)]);

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height, width: "100%" }}>
      <div className="tradingview-widget-container__widget" style={{ height: "calc(100% - 32px)", width: "100%" }} />
    </div>
  );
}

export default memo(TradingViewChart);
