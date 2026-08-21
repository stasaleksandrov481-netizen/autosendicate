'use client';

export type ProfileTag = {
  key: string;
  label: string;
  emoji?: string;
  background?: string;
  foreground?: string;
  border?: string;
  glow?: boolean;
};

export function TagBadge({ tag }: { tag: ProfileTag }) {
  return (
    <span className="profile-tag" style={{
      background: tag.background ?? '#374151',
      color: tag.foreground ?? '#fff',
      borderColor: tag.border ?? tag.background ?? '#374151',
      boxShadow: tag.glow ? `0 0 14px ${tag.background ?? '#fff'}66` : undefined
    }}>
      {tag.emoji ? <span>{tag.emoji}</span> : null}{tag.label}
    </span>
  );
}

export function TagList({ tags }: { tags?: ProfileTag[] | null }) {
  if (!tags?.length) return null;
  return <span className="profile-tag-list">{tags.map((tag)=><TagBadge key={tag.key} tag={tag}/>)}</span>;
}
