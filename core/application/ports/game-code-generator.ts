export interface GameCodeGenerator {
  /** Código de 6 dígitos (100000–999999) SIN verificar unicidad. */
  generate(): string;
}
