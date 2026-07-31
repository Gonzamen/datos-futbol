import { invalid } from '../errors.js'
import type { Dependencies } from '../dependencies.js'

export async function renamePerson(
  deps: Pick<Dependencies, 'people'>,
  personId: string,
  name: string,
): Promise<void> {
  const clean = name.trim().replace(/\s+/g, ' ')

  if (!clean) {
    throw invalid('El nombre no puede estar vacío.')
  }

  await deps.people.rename(personId, clean)
}
