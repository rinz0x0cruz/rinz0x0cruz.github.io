export async function openAllProjects(page) {
  await page.getByRole('button', { name: /All projects/ }).click()
}