import { docs, meta } from '@/.source';
import { loader } from 'fumadocs-core/source';

export const source = loader({
  baseUrl: '/docs',
  source: createSource(),
});

function createSource() {
  return { ...docs.toFumadocsSource(), ...meta.toFumadocsSource() };
}
