/* 
    path: D:\boulot\python\wollama\src\lib\db\dbFields.ts
 */

import type { CollectionModel, IdbqModel, TplCollectionName, Tpl, TplFields } from '@medyll/idbql';
import { schemeModel } from './dbSchema';

export enum enumPrimitive {
    id = 'id',
    any = 'any',
    date = 'date',
    datetime = 'datetime',
    time = 'time',
    text = 'text',
    number = 'number',
    boolean = 'boolean',
    url = 'url',
    email = 'email',
    phone = 'phone',
    password = 'password',
}

export enum TplProperties {
    'private' = 'private',
    'readonly' = 'readonly',
    'required' = 'required',
}

type CombineElements<T extends string, U extends string = T> = T extends any ? T | `${T} ${CombineElements<Exclude<U, T>>}` : never;
type CombinedArgs = CombineElements<TplProperties>;

type IdbObjectify<T extends string = 'number'> = `array-of-${T}` | `object-${T}`;

// make a method parse primitive types
export type IdDbPrimitive<T = {}> =
    | keyof typeof enumPrimitive
    | `text-${'tiny' | 'short' | 'medium' | 'long' | 'giant'}`
    | `${string}.${string}`
    | `fk-${string}.${string}`;

export type IDbObjectPrimitive = IdbObjectify<IdDbPrimitive>;
export type IDbFk = `fk-${string}.${string}`;
export type IDbFkObject = IdbObjectify<IDbFk>;
export type IDbTypes = IdDbPrimitive | IDbObjectPrimitive | IDbFk | IDbFkObject;

export type IDBArgumentsTypes = `${IDbTypes}(${CombinedArgs})`;
const a: IDBArgumentsTypes = 'any(private required readonly)';
// final types all together
export type IDbFieldRules = IDBArgumentsTypes | IDbTypes;
export type IDbFieldType = IDBArgumentsTypes | IDbTypes;

export type IDbForge = {
    collection?: TplCollectionName;
    fieldName?: keyof TplFields;
    fieldType?: IDbFieldType;
    fieldRule?: IDbFieldRules;
    fieldArgs?: [keyof typeof TplProperties] | undefined;
    is: any;
};
/* 
    renamed from DbCollectionError to IDbErrors
 */
class IDbError extends Error {
    constructor(
        message: string,
        public readonly code: string
    ) {
        super(message);
        this.name = 'DbCollectionError';
    }
    static throwError(message: string, code: string) {
        throw new IDbError(message, code);
    }

    static handleError(error: unknown): void {
        if (error instanceof IDbError) {
            console.error(`${error.name}: ${error.message} (Code: ${error.code})`);
        } else {
            console.error('Unexpected error:', error);
        }
    }
}

export class IDbFields<T = Record<string, any>> {
    model: IdbqModel = schemeModel;

    constructor(model?: IdbqModel) {
        this.model = schemeModel; //model ?? this.model;
    }

    parseAllCollections(): Record<string, Record<string, IDbForge | undefined> | undefined> {
        let out: Record<string, Record<string, IDbForge | undefined> | undefined> = {};
        Object.keys(this.model).forEach((collection) => {
            out[collection] = this.parseRawCollection(collection as TplCollectionName);
        });

        return out;
    }

    parseRawCollection(collection: TplCollectionName): Record<string, IDbForge | undefined> | undefined {
        const fields = this.getCollectionTemplateFields(collection);
        if (!fields) return;
        let out: Record<string, IDbForge | undefined> = {};

        Object.keys(fields).forEach((fieldName) => {
            let fieldType = fields[fieldName];
            if (fieldType) {
                out[fieldName] = this.parseCollectionFieldName(collection, fieldName);
            }
        });

        return out;
    }

    parseCollectionFieldName(collection: TplCollectionName, fieldName: keyof TplFields): IDbForge | undefined {
        const field = this.#getTemplateFieldRule(collection, fieldName);
        if (!field) {
            IDbError.throwError(`Field ${fieldName} not found in collection ${collection}`, 'FIELD_NOT_FOUND');
            return undefined;
        }
        let fieldType = this.testIs('primitive', field) ?? this.testIs('array', field) ?? this.testIs('object', field) ?? this.testIs('fk', field);

        return this.forge({ collection, fieldName, ...fieldType });
    }

    parsFieldRule(fieldRule: IDbFieldRules) {
        if (!fieldRule) return;
        let fieldType =
            this.testIs('primitive', fieldRule) ?? this.testIs('array', fieldRule) ?? this.testIs('object', fieldRule) ?? this.testIs('fk', fieldRule);

        return fieldType;
    }

    private forge({ collection, fieldName, fieldType, fieldRule, fieldArgs, is }: IDbForge): IDbForge {
        return {
            collection,
            fieldName,
            fieldType,
            fieldRule,
            fieldArgs,
            is,
        };
    }

    #getModel() {
        return this.model;
    }

    getCollection(collection: TplCollectionName) {
        return this.#getModel()[String(collection)] as CollectionModel;
    }
    getCollectionTemplate(collection: TplCollectionName) {
        return this.getCollection(collection)['template'] as Tpl;
    }
    getCollectionTemplateFks(collection: TplCollectionName) {
        return this.getCollection(collection)['template']?.fks as Tpl['fks'];
    }
    getIndexName(collection: string) {
        return this.getCollection(collection)?.template?.index;
    }
    getCollectionTemplateFields(collection: TplCollectionName) {
        return this.getCollectionTemplate(collection)?.fields as TplFields;
    }
    getTemplatePresentation(collection: TplCollectionName) {
        return this.getCollectionTemplate(collection)?.presentation as string;
    }
    #getTemplateFieldRule(collection: TplCollectionName, fieldName: keyof TplFields) {
        return this.getCollectionTemplateFields(collection)?.[String(fieldName)] as IDbFieldRules | undefined;
    }

    getFkFieldType(string: `${string}.${string}`) {
        const [collection, field] = string.split('.') as [string, string];
        let template = this.#getTemplateFieldRule(collection, field as any);

        return template as IDbFieldRules | undefined;
    }

    getFkTemplateFields(string: `${string}.${string}`) {
        const [collection, field] = string.split('.') as [string, string];
        return this.getCollection(collection).template?.fields;
    }

    private testIs(what: 'array' | 'object' | 'fk' | 'primitive', fieldRule: IDbFieldRules): Partial<IDbForge> | undefined {
        const typeMappings = {
            fk: 'fk-',
            array: 'array-of-',
            object: 'object-',
            primitive: '',
        };
        const prefix = typeMappings[what];
        if (fieldRule.startsWith(prefix)) {
            return this.is(what, fieldRule);
        }
        return undefined;
    }

    is(what: 'array' | 'object' | 'fk' | 'primitive', fieldRule: IDbFieldRules): Partial<IDbForge> {
        return this.extract(what, fieldRule);
    }

    indexValue(collection: TplCollectionName, data: Record<string, any>) {
        let presentation = this.getIndexName(collection);
        return data[presentation];
    }

    extract(type: 'array' | 'object' | 'fk' | 'primitive', fieldRule: IDbFieldRules): Partial<IDbForge> {
        // fieldType
        function extractAfter(pattern: string, source: string) {
            // remove all between () on source
            const reg = source?.split('(')?.[0];

            return reg.split(pattern)[1] as IDbFieldRules;
        }

        function extractArgs(source: string): { piece: any; args: [TplProperties] | [keyof typeof TplProperties] } | undefined {
            const [piece, remaining] = source.split('(');
            if (!remaining) return { piece, args: undefined };
            const [central] = remaining?.split(')');
            const args = central?.split(' ') as [TplProperties] | [keyof typeof TplProperties];
            // console.log({ piece, args });
            return { piece, args };
        }

        let extractedArgs = extractArgs(fieldRule);
        let fieldType;
        let is = extractedArgs?.piece;
        let fieldArgs = extractedArgs?.args;
        switch (type) {
            case 'array':
                fieldType = extractAfter('array-of-', fieldRule);
                is = is ?? fieldType;
                break;
            case 'object':
                fieldType = extractAfter('object-', fieldRule);
                is = is ?? fieldType;
                break;
            case 'fk':
                fieldType = this.getFkFieldType(extractAfter('fk-', fieldRule));
                is = extractedArgs?.piece;
                break;
            case 'primitive':
                console.log({ fieldRule, extractedArgs });
                fieldType = extractedArgs?.piece;
                is = is ?? fieldType;
                break;
        }

        return { fieldType, fieldRule, fieldArgs, is: type };
    }

    fks(collection: string): { [collection: string]: Tpl } {
        let fks = this.getCollectionTemplateFks(collection);
        let out: Record<string, any> = {};
        // loop over fks
        if (fks) {
            Object.keys(fks).forEach((collection: TplCollectionName) => {
                out[collection] = this.parseRawCollection(collection as TplCollectionName);
            });
        }
        return out;
    }

    reverseFks(targetCollection: TplCollectionName): Record<string, any> {
        const result: Record<string, any> = {};

        Object.entries(this.#getModel()).forEach(([collectionName, collectionModel]) => {
            const template = (collectionModel as CollectionModel).template;
            if (template && template.fks) {
                Object.entries(template.fks).forEach(([fkName, fkConfig]) => {
                    if (fkConfig?.code === targetCollection) {
                        if (!result[collectionName]) {
                            result[collectionName] = {};
                        }
                        result[collectionName][fkName] = fkConfig;
                    }
                });
            }
        });

        return result;
    }
}

// display field values, based on schema and provided data
// renamed from iDBFieldValues to iDbCollectionValues
export class iDbCollectionValues<T extends Record<string, any>> {
    private dbFields: IDbFields;
    private collection: TplCollectionName;

    constructor(collection: TplCollectionName) {
        this.collection = collection;
        this.dbFields = new IDbFields();
    }

    presentation(data: Record<string, any>): string {
        try {
            this.#checkError(!this.#checkAccess(), 'Access denied', 'ACCESS_DENIED');
            const presentation = this.dbFields.getTemplatePresentation(this.collection);
            this.#checkError(!presentation, 'Presentation template not found', 'TEMPLATE_NOT_FOUND');

            const fields = presentation.split(' ');
            return fields
                .map((field: string) => {
                    this.#checkError(!(field in data), `Field ${field} not found in data`, 'FIELD_NOT_FOUND');
                    return data[field];
                })
                .join(' ');
        } catch (error) {
            IDbError.handleError(error);
            return '';
        }
    }

    indexValue(data: Record<string, any>): any | null {
        try {
            this.#checkError(!this.#checkAccess(), 'Access denied', 'ACCESS_DENIED');
            const indexName = this.dbFields.getIndexName(this.collection);
            this.#checkError(!indexName, 'Index not found for collection', 'INDEX_NOT_FOUND');
            this.#checkError(!(indexName in data), `Index field ${indexName} not found in data`, 'FIELD_NOT_FOUND');
            return data[indexName];
        } catch (error) {
            IDbError.handleError(error);
            return null;
        }
    }

    format(fieldName: keyof T, data: T): string {
        try {
            this.#checkError(!this.#checkAccess(), 'Access denied', 'ACCESS_DENIED');
            this.#checkError(!(fieldName in data), `Field ${String(fieldName)} not found in data`, 'FIELD_NOT_FOUND');
            const fieldInfo = this.dbFields.parseCollectionFieldName(this.collection, fieldName as string);
            this.#checkError(!fieldInfo, `Field ${String(fieldName)} not found in collection`, 'FIELD_NOT_FOUND');

            switch (fieldInfo?.fieldType) {
                case 'number':
                    return this.#formatNumberField(data[fieldName]);
                case 'text':
                case 'text-tiny':
                case 'text-short':
                case 'text-medium':
                case 'text-long':
                case 'text-giant':
                    return this.#formatTextField(data[fieldName], fieldInfo.fieldType);
                default:
                    return String(data[fieldName]);
            }
        } catch (error) {
            IDbError.handleError(error);
            return '';
        }
    }

    #formatNumberField(value: number): string {
        // Implement number formatting logic here
        return value.toString();
    }

    #formatTextField(value: string, type: string): string {
        const lengths = { 'text-tiny': 10, 'text-short': 20, 'text-medium': 30, 'text-long': 40, 'text-giant': 50 };
        const maxLength = lengths[type as keyof typeof lengths] || value.length;
        return value.substring(0, maxLength);
    }

    #checkAccess(): boolean {
        // Implement access check logic here
        return true;
    }

    #checkError(condition: boolean, message: string, code: string): void {
        if (condition) {
            IDbError.throwError(message, code);
        }
    }
}

export class iDbCollectionFieldValues<T extends Record<string, any>> {
    collection: TplCollectionName;
    collectionDataRow: iDbCollectionValues<T>;
    data: T;

    constructor(collection: TplCollectionName, data: T) {
        this.collection = collection;
        this.collectionDataRow = new iDbCollectionValues(collection);
        this.data = data;
    }

    format(fieldName: keyof T): string {
        return this.collectionDataRow.format(fieldName, this.data);
    }
}

class IDbValidationError extends Error {
    constructor(
        public field: string,
        public code: string,
        message: string
    ) {
        super(message);
        this.name = 'IDbValidationError';
    }
}

export class IDbFormValidate {
    private dbFields: IDbFields;

    constructor(private collection: TplCollectionName) {
        this.dbFields = new IDbFields();
    }

    validateField(fieldName: keyof TplFields, value: any): { isValid: boolean; error?: string } {
        try {
            const fieldInfo = this.dbFields.parseCollectionFieldName(this.collection, fieldName);
            if (!fieldInfo) {
                return { isValid: false, error: `Field ${String(fieldName)} not found in collection` };
            }
            // Vérification du type
            if (!this.#validateType(value, fieldInfo.fieldType)) {
                return this.#returnError(fieldName, fieldInfo.fieldType);
            }

            // Vérification des arguments du champ (required, etc.)
            if (fieldInfo.fieldArgs) {
                for (const arg of fieldInfo.fieldArgs) {
                    if (arg === 'required' && (value === undefined || value === null || value === '')) {
                        return this.#returnError(fieldName, 'required');
                    }
                }
            }

            // Validations spécifiques selon le type de champ
            switch (fieldInfo.fieldType) {
                case enumPrimitive.email:
                    if (!this.validateEmail(value)) {
                        return this.#returnError(fieldName, fieldInfo.fieldType);
                    }
                    break;
                case enumPrimitive.url:
                    if (!this.validateUrl(value)) {
                        return this.#returnError(fieldName, fieldInfo.fieldType);
                    }
                    break;
                case enumPrimitive.phone:
                    if (!this.validatePhone(value)) {
                        return this.#returnError(fieldName, fieldInfo.fieldType);
                    }
                    break;
                case enumPrimitive.date:
                case enumPrimitive.datetime:
                case enumPrimitive.time:
                    if (!this.validateDateTime(value, fieldInfo.fieldType)) {
                        return this.#returnError(fieldName, fieldInfo.fieldType);
                    }
                    break;
                // Ajoutez d'autres cas spécifiques ici
            }

            return { isValid: true };
        } catch (error) {
            if (error instanceof IDbValidationError) {
                return { isValid: false, error: error.message };
            }
            throw error;
        }
    }

    validateFieldValue(fieldName: keyof TplFields, value: any): boolean {
        try {
            this.validateField(fieldName, value);
            return true;
        } catch {
            return false;
        }
    }

    validateForm(formData: Record<string, any>): {
        isValid: boolean;
        errors: Record<string, string>;
        invalidFields: string[];
    } {
        const errors: Record<string, string> = {};
        const invalidFields: string[] = [];
        let isValid = true;

        const fields = this.dbFields.getCollectionTemplateFields(this.collection);
        if (!fields) {
            return {
                isValid: false,
                errors: { general: 'Collection template not found' },
                invalidFields: ['general'],
            };
        }

        for (const [fieldName, fieldRule] of Object.entries(fields)) {
            const result = this.validateField(fieldName as keyof TplFields, formData[fieldName]);
            if (!result.isValid) {
                errors[fieldName] = result.error || 'Invalid field';
                invalidFields.push(fieldName);
                isValid = false;
            }
        }

        return { isValid, errors, invalidFields };
    }

    #validateType(value: any, type: string | undefined): boolean {
        switch (type) {
            case enumPrimitive.number:
                return typeof value === 'number' && !isNaN(value);
            case enumPrimitive.boolean:
                return typeof value === 'boolean';
            case enumPrimitive.text:
            case enumPrimitive.email:
            case enumPrimitive.url:
            case enumPrimitive.phone:
            case enumPrimitive.password:
                return typeof value === 'string';
            case enumPrimitive.date:
            case enumPrimitive.datetime:
            case enumPrimitive.time:
                return value instanceof Date || typeof value === 'string';
            case enumPrimitive.any:
                return true;
            default:
                return true; // Pour les types non gérés, on considère que c'est valide
        }
    }

    #returnError(fieldName: keyof TplFields, enumCode: enumPrimitive | string | undefined): never {
        throw new IDbValidationError(String(fieldName), enumCode ?? 'unknown', `Invalid format for field ${String(fieldName)}. Cause "${enumCode}" `);
    }

    private validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private validateUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    private validatePhone(phone: string): boolean {
        // Ceci est un exemple simple. Vous pouvez ajuster selon vos besoins spécifiques
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        return phoneRegex.test(phone);
    }

    private validateDateTime(value: string | Date, type: string): boolean {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return false;

        switch (type) {
            case enumPrimitive.date:
                return true; // La conversion en Date a déjà validé le format
            case enumPrimitive.time:
                // Vérifiez si la chaîne contient uniquement l'heure
                return /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(value as string);
            case enumPrimitive.datetime:
                return true; // La conversion en Date a déjà validé le format
            default:
                return false;
        }
    }

    // Ajoutez d'autres méthodes de validation spécifiques ici
}
