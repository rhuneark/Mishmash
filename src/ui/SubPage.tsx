import type { ReactNode } from 'react';

/** A page opened from the title screen: a back button, a title, then the page. */
export function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="subpage">
      <div className="subpage-head">
        <button className="btn small" onClick={onBack}>
          ‹ Back
        </button>
        <div className="subpage-title">{title}</div>
        <span className="subpage-space" />
      </div>
      {children}
    </div>
  );
}
