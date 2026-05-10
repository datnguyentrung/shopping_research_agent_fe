import "./ProcessingStatus.scss";

interface ProcessingStatusProps {
  text: string;
  percent?: number;
}

function LoadingDots() {
  return (
    <span className="a2ui-processing__dots" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

export default function ProcessingStatus({
  text,
  percent,
}: ProcessingStatusProps) {
  const progressPercent =
    typeof percent === "number" ? Math.max(0, Math.min(100, percent)) : null;

  if (progressPercent === null) {
    return (
      <div className="a2ui-processing">
        <div className="a2ui-processing__header">
          <div className="a2ui-processing__spinner" />
          <p key={text} className="a2ui-processing__text">
            {text}
            <LoadingDots />
          </p>
        </div>
        <div className="a2ui-processing__track">
          <div className="a2ui-processing__bar a2ui-processing__bar--indeterminate" />
        </div>
      </div>
    );
  }

  const isComplete = progressPercent >= 100;

  return (
    <div className="a2ui-processing">
      <div className="a2ui-processing__header">
        <div className="a2ui-processing__spinner" />
        <p key={text} className="a2ui-processing__text">
          {text}
          {!isComplete && <LoadingDots />}
        </p>
        <span className="a2ui-processing__percent">{progressPercent}%</span>
      </div>
      <div className="a2ui-processing__track">
        <div
          className="a2ui-processing__bar"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="a2ui-processing__stripes" />
          {!isComplete && <div className="a2ui-processing__shimmer" />}
        </div>
      </div>
      <div className="a2ui-processing__steps">
        {[0, 25, 50, 75, 100].map((step) => (
          <div
            key={step}
            className={`a2ui-processing__step ${
              progressPercent >= step ? "a2ui-processing__step--done" : ""
            }`}
          >
            <div className="a2ui-processing__step-dot" />
            <span className="a2ui-processing__step-label">{step}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
