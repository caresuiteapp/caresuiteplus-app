export async function printCarePlan(html: string): Promise<void> {
  const page = window.open('', '_blank');
  if (!page) throw Error('Das Druckfenster wurde blockiert. Bitte Pop-ups für CareSuite erlauben.');
  try {
    page.opener = null;
    page.document.open();
    page.document.write(html);
    page.document.close();
    page.focus();
    page.print();
  } catch (error) {
    page.close();
    throw error;
  }
}
