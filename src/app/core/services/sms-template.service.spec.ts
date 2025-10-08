// src/app/core/services/sms-template.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SMSTemplateService } from './sms-template.service';
import { EnvironmentService } from './environment.service';
import { NotificationService } from './notification.service';
import { SMSEncoding, ParsedClientRecord } from '../models';

describe('SMSTemplateService', () => {
    let service: SMSTemplateService;
    let environmentService: jasmine.SpyObj<EnvironmentService>;
    let notificationService: jasmine.SpyObj<NotificationService>;

    beforeEach(() => {
        const envSpy = jasmine.createSpyObj('EnvironmentService', [
            'getSMSApiConfig',
            'isConsoleLoggingEnabled'
        ]);

        const notifSpy = jasmine.createSpyObj('NotificationService', [
            'success',
            'error',
            'warning',
            'info'
        ]);

        // Mock environment config
        envSpy.getSMSApiConfig.and.returnValue({
            characterLimits: {
                standard: 160,
                unicode: 70,
                concat: {
                    standard: 153,
                    unicode: 67
                }
            }
        } as any);

        TestBed.configureTestingModule({
            providers: [
                SMSTemplateService,
                { provide: EnvironmentService, useValue: envSpy },
                { provide: NotificationService, useValue: notifSpy }
            ]
        });

        service = TestBed.inject(SMSTemplateService);
        environmentService = TestBed.inject(EnvironmentService) as jasmine.SpyObj<EnvironmentService>;
        notificationService = TestBed.inject(NotificationService) as jasmine.SpyObj<NotificationService>;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Template CRUD', () => {
        it('should return default template', (done: DoneFn) => {
            service.getTemplates().subscribe(templates => {
                expect(templates.length).toBe(1);
                expect(templates[0].name).toBe('Напомняне за изтичащ договор');
                done();
            });
        });

        it('should create new template', () => {
            const newTemplate = service.createTemplate({
                name: 'Test Template',
                content: 'Hello {Ime_Firma}!',
                placeholders: [],
                characterInfo: {
                    baseLength: 0,
                    encoding: SMSEncoding.STANDARD,
                    estimatedParts: 1
                }
            });

            expect(newTemplate).toBeDefined();
            expect(newTemplate.id).toBeTruthy();
            expect(newTemplate.name).toBe('Test Template');
            expect(notificationService.success).toHaveBeenCalled();
        });

        it('should update template', (done: DoneFn) => {
            service.getTemplates().subscribe(templates => {
                const templateId = templates[0].id;

                service.updateTemplate(templateId, {
                    name: 'Updated Name'
                });

                const updated = service.getTemplateById(templateId);
                expect(updated?.name).toBe('Updated Name');
                expect(notificationService.success).toHaveBeenCalled();
                done();
            });
        });

        it('should not delete last template', (done: DoneFn) => {
            service.getTemplates().subscribe(templates => {
                const templateId = templates[0].id;

                service.deleteTemplate(templateId);

                expect(notificationService.warning).toHaveBeenCalled();
                expect(service.getTemplateById(templateId)).toBeDefined();
                done();
            });
        });
    });

    describe('Encoding Detection', () => {
        it('should detect Cyrillic as Unicode', () => {
            const encoding = service.detectEncoding('Здравейте!');
            expect(encoding).toBe(SMSEncoding.UNICODE);
        });

        it('should detect Latin as Standard', () => {
            const encoding = service.detectEncoding('Hello!');
            expect(encoding).toBe(SMSEncoding.STANDARD);
        });

        it('should detect mixed as Unicode', () => {
            const encoding = service.detectEncoding('Hello Здравей');
            expect(encoding).toBe(SMSEncoding.UNICODE);
        });

        it('should detect emoji as Unicode', () => {
            const encoding = service.detectEncoding('Hello 👋');
            expect(encoding).toBe(SMSEncoding.UNICODE);
        });
    });

    describe('Character Count', () => {
        it('should calculate Standard SMS correctly', () => {
            const result = service.calculateCharacterCount('Hello World!');

            expect(result.count).toBe(12);
            expect(result.encoding).toBe(SMSEncoding.STANDARD);
            expect(result.estimatedParts).toBe(1);
            expect(result.estimatedCost).toBe(0.16);
        });

        it('should calculate Unicode SMS correctly', () => {
            const result = service.calculateCharacterCount('Здравейте!');

            expect(result.count).toBe(10);
            expect(result.encoding).toBe(SMSEncoding.UNICODE);
            expect(result.estimatedParts).toBe(1);
            expect(result.estimatedCost).toBe(0.16);
        });

        it('should calculate concatenated SMS parts', () => {
            const longMessage = 'A'.repeat(200); // 200 chars Standard
            const result = service.calculateCharacterCount(longMessage);

            expect(result.estimatedParts).toBe(2); // 160 + 40 → 2 parts (153 per concat)
        });

        it('should calculate Unicode concatenated parts', () => {
            const cyrillicLong = 'А'.repeat(100); // 100 Cyrillic chars
            const result = service.calculateCharacterCount(cyrillicLong);

            expect(result.encoding).toBe(SMSEncoding.UNICODE);
            expect(result.estimatedParts).toBe(2); // 70 + 30 → 2 parts (67 per concat)
        });
    });

    describe('Template Validation', () => {
        it('should validate correct template', () => {
            const content = 'Hello {Ime_Firma}! Contract {Number} expires.';
            const validation = service.validateTemplate(content);

            expect(validation.isValid).toBe(true);
            expect(validation.errors.length).toBe(0);
        });

        it('should reject empty template', () => {
            const validation = service.validateTemplate('');

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });

        it('should warn about invalid placeholders', () => {
            const content = 'Hello {InvalidField}!';
            const validation = service.validateTemplate(content);

            expect(validation.warnings.length).toBeGreaterThan(0);
        });

        it('should warn about very long templates', () => {
            const longContent = 'A'.repeat(1000);
            const validation = service.validateTemplate(longContent);

            expect(validation.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('Placeholder Substitution', () => {
        let mockRecord: ParsedClientRecord;

        beforeEach(() => {
            mockRecord = {
                id: 'test-1',
                Number: '12345',
                End_Data: '10/30/25 00:00:00',
                parsedEndDate: new Date(2025, 9, 30),
                Model: 'TestModel',
                Number_EKA: 'EKA-123',
                Phone: '+359888123456',
                Ime_Firma: 'Test Company',
                bulst: 'BG123456',
                phoneNumbers: [{
                    original: '359888123456',
                    formatted: '+359888123456',
                    selected: true,
                    isValid: true,
                    id: 'phone-1'
                }],
                hasMultiplePhones: false,
                selectedPhoneCount: 1,
                requiresPhoneSelection: false,
                isValid: true
            } as ParsedClientRecord;
        });

        it('should replace all placeholders', () => {
            const template = service.getCurrentTemplate();
            const personalized = service.generatePersonalizedSMS(template, mockRecord);

            expect(personalized.content).toContain('Test Company');
            expect(personalized.content).toContain('12345');
            expect(personalized.content).toContain('TestModel');
        });

        it('should format date correctly', () => {
            const template = service.getCurrentTemplate();
            const personalized = service.generatePersonalizedSMS(template, mockRecord);

            expect(personalized.content).toContain('30.10.2025');
        });

        it('should use selected phone number', () => {
            mockRecord.phoneNumbers = [
                { formatted: '+359888111222', selected: false, isValid: true, id: '1', original: '' },
                { formatted: '+359888333444', selected: true, isValid: true, id: '2', original: '' }
            ];

            const template = service.getCurrentTemplate();
            const personalized = service.generatePersonalizedSMS(template, mockRecord);

            expect(personalized.content).toContain('+359888333444');
        });

        it('should calculate character count for personalized SMS', () => {
            const template = service.getCurrentTemplate();
            const personalized = service.generatePersonalizedSMS(template, mockRecord);

            expect(personalized.characterCount).toBeGreaterThan(0);
            expect(personalized.encoding).toBe(SMSEncoding.UNICODE); // Cyrillic in default template
        });

        it('should mark SMS as invalid if no valid phone', () => {
            mockRecord.phoneNumbers = [];

            const template = service.getCurrentTemplate();
            const personalized = service.generatePersonalizedSMS(template, mockRecord);

            expect(personalized.isValid).toBe(false);
            expect(personalized.validationErrors?.length).toBeGreaterThan(0);
        });
    });

    describe('Batch Generation', () => {
        let mockRecords: ParsedClientRecord[];

        beforeEach(() => {
            mockRecords = [
                {
                    id: '1',
                    Number: '111',
                    Ime_Firma: 'Company A',
                    phoneNumbers: [{
                        formatted: '+359888111111',
                        selected: true,
                        isValid: true,
                        id: 'p1',
                        original: ''
                    }],
                    hasMultiplePhones: false,
                    selectedPhoneCount: 1,
                    requiresPhoneSelection: false,
                    isValid: true
                } as ParsedClientRecord,
                {
                    id: '2',
                    Number: '222',
                    Ime_Firma: 'Company B',
                    phoneNumbers: [{
                        formatted: '+359888222222',
                        selected: true,
                        isValid: true,
                        id: 'p2',
                        original: ''
                    }],
                    hasMultiplePhones: false,
                    selectedPhoneCount: 1,
                    requiresPhoneSelection: false,
                    isValid: true
                } as ParsedClientRecord
            ];
        });

        it('should generate SMS for all records', () => {
            const template = service.getCurrentTemplate();
            const allSMS = service.generateBatchSMS(template, mockRecords);

            expect(allSMS.length).toBe(2);
            expect(allSMS[0].content).toContain('Company A');
            expect(allSMS[1].content).toContain('Company B');
        });

        it('should calculate total cost', () => {
            const template = service.getCurrentTemplate();
            const allSMS = service.generateBatchSMS(template, mockRecords);

            const totalCost = allSMS.reduce((sum, sms) => sum + sms.estimatedCost, 0);
            expect(totalCost).toBeGreaterThan(0);
        });
    });

    describe('Preview', () => {
        it('should generate preview with sample data', () => {
            const template = service.getCurrentTemplate();
            const preview = service.previewTemplate(template);

            expect(preview).toBeTruthy();
            expect(preview).toContain('Софтуер България ЕООД');
            expect(preview).toContain('12345');
        });
    });

    describe('Available Placeholders', () => {
        it('should return all available placeholders', () => {
            const placeholders = service.getAvailablePlaceholders();

            expect(placeholders).toContain('Number');
            expect(placeholders).toContain('Ime_Firma');
            expect(placeholders).toContain('Phone');
            expect(placeholders).toContain('End_Data');
        });

        it('should return placeholder descriptions', () => {
            const descriptions = service.getPlaceholderDescriptions();

            expect(descriptions.length).toBeGreaterThan(0);
            expect(descriptions[0].key).toBeDefined();
            expect(descriptions[0].description).toBeDefined();
            expect(descriptions[0].example).toBeDefined();
        });
    });

    describe('Template Statistics', () => {
        it('should calculate template statistics', () => {
            const template = service.getCurrentTemplate();
            const stats = service.getTemplateStatistics(template);

            expect(stats.totalPlaceholders).toBeGreaterThan(0);
            expect(stats.uniquePlaceholders).toBeGreaterThan(0);
            expect(stats.encoding).toBeDefined();
        });
    });

    describe('Reset', () => {
        it('should reset to default template', () => {
            // Create new template
            service.createTemplate({
                name: 'Custom',
                content: 'Test',
                placeholders: [],
                characterInfo: { baseLength: 0, encoding: SMSEncoding.STANDARD, estimatedParts: 1 }
            });

            // Reset
            service.resetToDefault();

            // Check
            service.getTemplates().subscribe(templates => {
                expect(templates.length).toBe(1);
                expect(templates[0].name).toBe('Напомняне за изтичащ договор');
            });
        });
    });
});