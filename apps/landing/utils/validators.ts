/**
 * 统一表单验证模块
 * 提供常用的验证规则、验证函数和 Element Plus 表单规则生成器
 */

// ==================== 正则表达式 ====================
export const REGEX = {
  /** 手机号：中国大陆手机号 */
  PHONE: /^1[3-9]\d{9}$/,
  /** 邮箱 */
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** 强密码：至少包含小写字母、大写字母、数字，长度8位以上 */
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  /** 验证码：6位数字 */
  CODE: /^\d{6}$/,
  /** URL：以 http:// 或 https:// 开头 */
  URL: /^https?:\/\/.+/,
  /** 用户名：字母、数字、下划线，长度3-20 */
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  /** 中文姓名：2-10个汉字 */
  CHINESE_NAME: /^[\u4e00-\u9fa5]{2,10}$/,
}

// ==================== 验证函数类型 ====================
export type ValidatorResult = string | true
export type ValidatorFn = (value: any) => ValidatorResult
export type FieldValidatorFn = (fieldName: string) => ValidatorFn

// ==================== 基础验证函数 ====================
export const validators = {
  /**
   * 手机号验证
   * @param value - 手机号
   * @returns true 验证通过，否则返回错误信息
   */
  phone: (value: string): ValidatorResult => {
    if (!value) return '请输入手机号'
    if (!REGEX.PHONE.test(value)) return '请输入正确的手机号'
    return true
  },

  /**
   * 验证码验证
   * @param value - 验证码
   * @returns true 验证通过，否则返回错误信息
   */
  code: (value: string): ValidatorResult => {
    if (!value) return '请输入验证码'
    if (!REGEX.CODE.test(value)) return '验证码为6位数字'
    return true
  },

  /**
   * 密码验证（基础版：至少6位）
   * @param value - 密码
   * @returns true 验证通过，否则返回错误信息
   */
  password: (value: string): ValidatorResult => {
    if (!value) return '请输入密码'
    if (value.length < 6) return '密码长度不能少于6位'
    return true
  },

  /**
   * 强密码验证（至少包含小写字母、大写字母、数字，长度8位以上）
   * @param value - 密码
   * @returns true 验证通过，否则返回错误信息
   */
  strongPassword: (value: string): ValidatorResult => {
    if (!value) return '请输入密码'
    if (value.length < 8) return '密码长度不能少于8位'
    if (!REGEX.PASSWORD.test(value)) {
      return '密码必须包含大小写字母和数字'
    }
    return true
  },

  /**
   * 邮箱验证
   * @param value - 邮箱地址
   * @returns true 验证通过，否则返回错误信息
   */
  email: (value: string): ValidatorResult => {
    if (!value) return '请输入邮箱'
    if (!REGEX.EMAIL.test(value)) return '请输入正确的邮箱地址'
    return true
  },

  /**
   * URL 验证
   * @param value - URL 地址
   * @returns true 验证通过，否则返回错误信息
   */
  url: (value: string): ValidatorResult => {
    if (!value) return '请输入链接地址'
    if (!REGEX.URL.test(value)) return '请输入正确的链接地址（以http://或https://开头）'
    return true
  },

  /**
   * 用户名验证
   * @param value - 用户名
   * @returns true 验证通过，否则返回错误信息
   */
  username: (value: string): ValidatorResult => {
    if (!value) return '请输入用户名'
    if (value.length < 3) return '用户名长度不能少于3位'
    if (value.length > 20) return '用户名长度不能超过20位'
    if (!REGEX.USERNAME.test(value)) {
      return '用户名只能包含字母、数字和下划线'
    }
    return true
  },

  /**
   * 中文姓名验证
   * @param value - 姓名
   * @returns true 验证通过，否则返回错误信息
   */
  chineseName: (value: string): ValidatorResult => {
    if (!value) return '请输入姓名'
    if (!REGEX.CHINESE_NAME.test(value)) return '请输入2-10个汉字'
    return true
  },

  /**
   * 必填验证
   * @param fieldName - 字段显示名称
   * @returns 验证函数
   */
  required: (fieldName: string): ValidatorFn => {
    return (value: any): ValidatorResult => {
      if (value === undefined || value === null || value === '') {
        return `请输入${fieldName}`
      }
      if (Array.isArray(value) && value.length === 0) {
        return `请选择${fieldName}`
      }
      return true
    }
  },

  /**
   * 长度范围验证
   * @param min - 最小长度
   * @param max - 最大长度
   * @param fieldName - 字段显示名称
   * @returns 验证函数
   */
  length: (min: number, max: number, fieldName: string): ValidatorFn => {
    return (value: string): ValidatorResult => {
      if (!value) return `请输入${fieldName}`
      if (value.length < min) return `${fieldName}长度不能少于${min}位`
      if (value.length > max) return `${fieldName}长度不能超过${max}位`
      return true
    }
  },

  /**
   * 数值范围验证
   * @param min - 最小值
   * @param max - 最大值
   * @param fieldName - 字段显示名称
   * @returns 验证函数
   */
  range: (min: number, max: number, fieldName: string): ValidatorFn => {
    return (value: number): ValidatorResult => {
      if (value === undefined || value === null) return `请输入${fieldName}`
      if (value < min) return `${fieldName}不能小于${min}`
      if (value > max) return `${fieldName}不能大于${max}`
      return true
    }
  },

  /**
   * 自定义正则验证
   * @param regex - 正则表达式
   * @param errorMsg - 错误信息
   * @returns 验证函数
   */
  pattern: (regex: RegExp, errorMsg: string): ValidatorFn => {
    return (value: string): ValidatorResult => {
      if (!value) return errorMsg
      if (!regex.test(value)) return errorMsg
      return true
    }
  },
}

// ==================== Element Plus 表单规则生成器 ====================

/**
 * 预定义的验证规则映射
 */
const PREDEFINED_RULES: Record<string, any> = {
  phone: { validator: validators.phone, trigger: 'blur' },
  code: { validator: validators.code, trigger: 'blur' },
  password: { validator: validators.password, trigger: 'blur' },
  strongPassword: { validator: validators.strongPassword, trigger: 'blur' },
  email: { validator: validators.email, trigger: 'blur' },
  url: { validator: validators.url, trigger: 'blur' },
  username: { validator: validators.username, trigger: 'blur' },
  chineseName: { validator: validators.chineseName, trigger: 'blur' },
}

/**
 * 创建单个字段的验证规则
 * @param type - 验证类型或自定义验证函数
 * @param options - 额外选项
 * @returns Element Plus 表单规则数组
 */
export function createRule(
  type: string | ValidatorFn,
  options: {
    required?: boolean
    fieldName?: string
    trigger?: string
    message?: string
  } = {}
): any[] {
  const { required = false, fieldName = '', trigger = 'blur', message } = options
  const rules: any[] = []

  // 必填验证
  if (required && fieldName) {
    rules.push({
      required: true,
      message: message || `请输入${fieldName}`,
      trigger,
    })
  }

  // 自定义验证器
  if (typeof type === 'function') {
    rules.push({
      validator: type,
      trigger,
    })
  } else if (PREDEFINED_RULES[type]) {
    // 预定义规则
    rules.push({
      ...PREDEFINED_RULES[type],
      trigger: trigger || PREDEFINED_RULES[type].trigger,
    })
  }

  return rules
}

/**
 * 批量创建表单验证规则
 * @param fields - 字段配置对象，key 为字段名，value 为验证类型
 * @returns Element Plus 表单规则对象
 * @example
 * const rules = createRules({
 *   phone: 'phone',
 *   code: 'code',
 *   password: 'password',
 *   email: { type: 'email', required: true },
 *   username: { type: 'username', fieldName: '用户名' },
 * })
 */
export function createRules(
  fields: Record<
    string,
    | string
    | ValidatorFn
    | {
        type: string | ValidatorFn
        required?: boolean
        fieldName?: string
        trigger?: string
        message?: string
      }
  >
): Record<string, any[]> {
  return Object.entries(fields).reduce((acc, [field, config]) => {
    if (typeof config === 'string') {
      // 简写形式: 'phone'
      acc[field] = createRule(config)
    } else if (typeof config === 'function') {
      // 自定义函数
      acc[field] = createRule(config)
    } else {
      // 完整配置对象
      const { type, ...options } = config
      acc[field] = createRule(type, options)
    }
    return acc
  }, {} as Record<string, any[]>)
}

/**
 * 创建动态表单规则（支持响应式）
 * 注意：此函数需要在 Vue 组件中使用，作为 computed 的 getter
 * @param fieldsGetter - 返回字段配置的函数
 * @returns 表单规则对象
 * @example
 * const rules = computed(() => createRules({
 *   phone: 'phone',
 *   password: mode.value === 'password' ? 'password' : { type: () => true },
 * }))
 */
export function createDynamicRules(
  fieldsGetter: () => Record<
    string,
    | string
    | ValidatorFn
    | {
        type: string | ValidatorFn
        required?: boolean
        fieldName?: string
        trigger?: string
        message?: string
      }
  >
): Record<string, any[]> {
  // 直接返回规则对象，需要在 Vue 组件中配合 computed 使用
  return createRules(fieldsGetter())
}

// ==================== 导出默认 ====================
export default {
  REGEX,
  validators,
  createRule,
  createRules,
  createDynamicRules,
}
