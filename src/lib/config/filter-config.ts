import {
  FilterConfiguration,
  FilterRules,
  WKR_2025_CONFIG,
  FilterError
} from '@/types/filter'

export class FilterConfigManager {
  private readonly STORAGE_PREFIX = 'wkr-filter-config'
  private readonly DEFAULT_CONFIG_KEY = 'default'

  // Save configuration to localStorage
  saveConfiguration(config: FilterConfiguration): void {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        console.warn('Cannot save configuration: localStorage not available on server')
        return
      }

      this.validateConfiguration(config)

      const storageKey = `${this.STORAGE_PREFIX}-${config.name.toLowerCase().replace(/\s+/g, '-')}`
      const configToStore = {
        ...config,
        lastModified: new Date()
      }

      localStorage.setItem(storageKey, JSON.stringify(configToStore))

      // Also update the list of available configurations
      this.updateConfigurationList(config.name)

    } catch (error) {
      throw new FilterError(
        `Fout bij opslaan van configuratie: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        'CONFIG_SAVE_ERROR',
        { configName: config.name }
      )
    }
  }

  // Load configuration from localStorage
  loadConfiguration(name: string): FilterConfiguration | null {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        return null
      }

      const storageKey = `${this.STORAGE_PREFIX}-${name.toLowerCase().replace(/\s+/g, '-')}`
      const saved = localStorage.getItem(storageKey)

      if (!saved) {
        return null
      }

      const config = JSON.parse(saved) as FilterConfiguration

      // Ensure dates are properly parsed
      config.lastModified = new Date(config.lastModified)

      this.validateConfiguration(config)
      return config

    } catch (error) {
      console.error('Error loading filter configuration:', error)
      return null
    }
  }

  // Get default configuration
  getDefaultConfiguration(): FilterConfiguration {
    return { ...WKR_2025_CONFIG }
  }

  // List all saved configurations
  listConfigurations(): string[] {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        return []
      }

      const listKey = `${this.STORAGE_PREFIX}-list`
      const saved = localStorage.getItem(listKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  // Delete a configuration
  deleteConfiguration(name: string): boolean {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        return false
      }

      const storageKey = `${this.STORAGE_PREFIX}-${name.toLowerCase().replace(/\s+/g, '-')}`
      localStorage.removeItem(storageKey)

      // Update the list
      const configs = this.listConfigurations().filter(config => config !== name)
      const listKey = `${this.STORAGE_PREFIX}-list`
      localStorage.setItem(listKey, JSON.stringify(configs))

      return true
    } catch {
      return false
    }
  }

  // Export configuration as JSON
  exportConfiguration(config: FilterConfiguration): string {
    try {
      return JSON.stringify(config, null, 2)
    } catch (error) {
      throw new FilterError(
        'Fout bij exporteren van configuratie',
        'CONFIG_EXPORT_ERROR'
      )
    }
  }

  // Import configuration from JSON
  importConfiguration(jsonString: string): FilterConfiguration {
    try {
      const config = JSON.parse(jsonString) as FilterConfiguration

      // Ensure required fields are present
      if (!config.name || !config.rules) {
        throw new Error('Ongeldig configuratieformaat: ontbrekende vereiste velden')
      }

      // Set import metadata
      config.lastModified = new Date()
      config.version = config.version || '1.0.0'

      this.validateConfiguration(config)
      return config

    } catch (error) {
      throw new FilterError(
        `Fout bij importeren van configuratie: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        'CONFIG_IMPORT_ERROR'
      )
    }
  }

  // Create a new configuration based on existing rules
  createConfiguration(
    name: string,
    description: string,
    rules: FilterRules,
    author?: string
  ): FilterConfiguration {
    return {
      name,
      description,
      rules,
      version: '1.0.0',
      author,
      lastModified: new Date()
    }
  }

  // Clone an existing configuration with modifications
  cloneConfiguration(
    sourceConfig: FilterConfiguration,
    newName: string,
    modifications?: Partial<FilterConfiguration>
  ): FilterConfiguration {
    const cloned: FilterConfiguration = {
      ...sourceConfig,
      name: newName,
      lastModified: new Date(),
      ...modifications
    }

    // Deep clone the rules to avoid reference issues
    cloned.rules = {
      includePatterns: [...sourceConfig.rules.includePatterns],
      excludePatterns: [...sourceConfig.rules.excludePatterns],
      excludeSpecific: [...sourceConfig.rules.excludeSpecific],
      customRules: sourceConfig.rules.customRules ?
        sourceConfig.rules.customRules.map(rule => ({ ...rule })) : undefined
    }

    this.validateConfiguration(cloned)
    return cloned
  }

  // Get predefined configurations
  getPredefinedConfigurations(): FilterConfiguration[] {
    return [
      WKR_2025_CONFIG,
      {
        name: "WKR Conservatief",
        description: "Conservatieve filterregels - alleen duidelijke omzetrekeningen",
        version: "1.0.0",
        rules: {
          includePatterns: ["40*", "41*"],
          excludePatterns: ["49*"],
          excludeSpecific: ["430000", "403130"],
          customRules: [
            {
              name: "Minimum bedrag",
              condition: (line) => Math.abs(line.amount) >= 100,
              reason: "Alleen significante bedragen (≥ €100)"
            }
          ]
        },
        lastModified: new Date()
      },
      {
        name: "WKR Uitgebreid",
        description: "Uitgebreide filterregels - alle relevante kostenrekeningen",
        version: "1.0.0",
        rules: {
          includePatterns: ["4*", "5*"],
          excludePatterns: ["49*", "59*"],
          excludeSpecific: ["430000", "403130"],
          customRules: [
            {
              name: "Exclude zero amounts",
              condition: (line) => line.amount !== 0,
              reason: "Nul-bedrag transacties zijn niet relevant voor WKR"
            }
          ]
        },
        lastModified: new Date()
      }
    ]
  }

  // Validate configuration
  private validateConfiguration(config: FilterConfiguration): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new FilterError('Configuratie naam is verplicht', 'INVALID_CONFIG_NAME')
    }

    if (!config.rules) {
      throw new FilterError('Filter regels zijn verplicht', 'MISSING_FILTER_RULES')
    }

    if (!config.rules.includePatterns || config.rules.includePatterns.length === 0) {
      throw new FilterError('Minimaal één include pattern is verplicht', 'MISSING_INCLUDE_PATTERNS')
    }

    // Validate patterns
    const allPatterns = [
      ...config.rules.includePatterns,
      ...config.rules.excludePatterns
    ]

    for (const pattern of allPatterns) {
      if (typeof pattern !== 'string' || pattern.length === 0) {
        throw new FilterError(`Ongeldig pattern: ${pattern}`, 'INVALID_PATTERN')
      }
    }

    // Validate custom rules if present
    if (config.rules.customRules) {
      for (const rule of config.rules.customRules) {
        if (!rule.name) {
          throw new FilterError(`Ongeldige custom rule: ${rule.name}`, 'INVALID_CUSTOM_RULE')
        }
        // Note: condition function may be lost during JSON serialization/deserialization
        // This is expected behavior and should not fail validation
      }
    }
  }

  // Update the list of available configurations
  private updateConfigurationList(configName: string): void {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        return
      }

      const listKey = `${this.STORAGE_PREFIX}-list`
      const currentList = this.listConfigurations()

      if (!currentList.includes(configName)) {
        currentList.push(configName)
        localStorage.setItem(listKey, JSON.stringify(currentList))
      }
    } catch (error) {
      console.warn('Could not update configuration list:', error)
    }
  }

  // Reset to factory defaults
  resetToDefaults(): void {
    try {
      // Check if running in browser environment
      if (typeof window === 'undefined') {
        console.warn('Cannot reset configurations: localStorage not available on server')
        return
      }

      // Clear all stored configurations
      const configs = this.listConfigurations()
      configs.forEach(name => this.deleteConfiguration(name))

      // Clear the list
      const listKey = `${this.STORAGE_PREFIX}-list`
      localStorage.removeItem(listKey)

    } catch (error) {
      throw new FilterError(
        'Fout bij resetten naar standaardwaarden',
        'RESET_ERROR'
      )
    }
  }

  // Get configuration summary for display
  getConfigurationSummary(config: FilterConfiguration): {
    name: string
    description: string
    ruleCount: number
    includePatterns: number
    excludePatterns: number
    customRules: number
    lastModified: string
  } {
    return {
      name: config.name,
      description: config.description,
      ruleCount: config.rules.includePatterns.length +
                config.rules.excludePatterns.length +
                config.rules.excludeSpecific.length +
                (config.rules.customRules?.length || 0),
      includePatterns: config.rules.includePatterns.length,
      excludePatterns: config.rules.excludePatterns.length,
      customRules: config.rules.customRules?.length || 0,
      lastModified: config.lastModified.toLocaleDateString('nl-NL')
    }
  }
}