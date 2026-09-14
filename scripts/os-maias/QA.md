# Revisão de qualidade — Os Maias

## Fonte e estrutura

- [x] Edição de 1888 transcrita pelo Project Gutenberg n.º 40409, 18 capítulos.
- [x] Texto narrativo integral preservado, sem aparato Gutenberg nem frontispício intermédio.
- [x] 72 eventos em uma cronologia editorial; títulos de capítulo e datas são editoriais e declarados em Lore.
- [x] Estados existem apenas para personagens presentes e são específicos por evento.

## Cartografia e arte

- [x] Cinco mapas originais: Portugal, Lisboa, Sintra, Ramalhete e Toca.
- [x] Todos os submapas têm um gateway único e locais próprios.
- [x] 30 retratos, 35 locais, 12 objetos e uma capa, todos distintos e visualmente inspecionados.
- [x] Direção visual: ilustração realista adulta, Portugal oitocentista; sem fotografias ou mapas usados como arte de entidade.

## Validação final

- [x] Marcadores e níveis de zoom conferidos visualmente nos cinco mapas; o eixo vertical Leaflet foi corrigido.
- [x] Playback testado entre Ramalhete, Portugal e Sintra, incluindo mudança automática de camada, centragem e zoom.
- [x] Dashboard em modo de leitura e todas as páginas de leitura/edição visitadas sem erros de consola.
- [x] Calendário revisto para mostrar a abertura em 1875, a analepse familiar desde 1820, a ação principal e o epílogo de 1887.
- [x] Validador dedicado, verificação lossless e testes específicos de catálogo/qualidade/compatibilidade concluídos.

## Resultado da suite comum

A execução integral de `libraryCatalogue`, `exampleQuality` e `exampleCompat` encontrou apenas 35 falhas preexistentes noutros exemplos. Os testes filtrados para **Os Maias** passaram: 17 testes, em três ficheiros. Nenhuma falha pertence a este exemplo.
