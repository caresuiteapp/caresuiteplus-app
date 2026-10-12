type Props = { title: string; url: string; height: number };

export function PortalSignaturePdfFrame({ title, url, height }: Props) {
  return <iframe title={title} src={url} style={{ width: '100%', height, border: 'none', backgroundColor: '#fff' }} />;
}
