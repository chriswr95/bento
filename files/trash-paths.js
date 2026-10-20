export const trashDirectory = '.bento-local/trash';
export const validTrashToken = token => typeof token === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(token);
export const trashPath = token => {
  if (!validTrashToken(token)) throw new Error('Invalid deleted-file identity.');
  return `${trashDirectory}/${token}.md`;
};
export const isTrashPath = name => typeof name === 'string' && name.startsWith(trashDirectory + '/') && name.endsWith('.md') && validTrashToken(name.slice(trashDirectory.length + 1, -3));
