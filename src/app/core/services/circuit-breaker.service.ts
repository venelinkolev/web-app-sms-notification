import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';

/**
 * Circuit breaker states
 */
export enum CircuitState {
    /** Normal operation - requests pass through */
    CLOSED = 'CLOSED',

    /** Circuit is open - requests fail immediately */
    OPEN = 'OPEN',

    /** Testing if service recovered - limited requests pass */
    HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastStateChange: Date;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
}

/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern to prevent cascading failures
 */
@Injectable({
    providedIn: 'root'
})
export class CircuitBreakerService {

    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime?: Date;
    private lastStateChange: Date = new Date();
    private resetTimer?: any;

    // Statistics
    private totalRequests = 0;
    private totalFailures = 0;
    private totalSuccesses = 0;

    // Configuration
    private config: {
        enabled: boolean;
        failureThreshold: number;
        resetTimeout: number;
        successThreshold: number;
        logStateChanges: boolean;
    };

    constructor(private environmentService: EnvironmentService) {
        const errorConfig = this.environmentService.getConfig().errorHandling;
        this.config = errorConfig.circuitBreaker || {
            enabled: true,
            failureThreshold: 5,
            resetTimeout: 30000,
            successThreshold: 2,
            logStateChanges: true
        };
    }

    /**
     * Execute request through circuit breaker
     */
    execute<T>(operation: Observable<T>, operationName?: string): Observable<T> {
        // If circuit breaker is disabled, pass through
        if (!this.config.enabled) {
            return operation;
        }

        // Check if circuit is open
        if (this.state === CircuitState.OPEN) {
            const error = new Error(
                `Circuit breaker е ОТВОРЕН. Операцията "${operationName || 'unknown'}" е блокирана.`
            );

            if (this.config.logStateChanges) {
                console.warn('⚠️ Circuit Breaker: Request blocked (circuit OPEN)', {
                    operation: operationName,
                    failureCount: this.failureCount,
                    lastFailure: this.lastFailureTime
                });
            }

            return throwError(() => error);
        }

        this.totalRequests++;

        return operation.pipe(
            tap(() => this.onSuccess(operationName)),
            catchError(error => {
                this.onFailure(operationName);
                return throwError(() => error);
            })
        );
    }

    /**
     * Handle successful request
     */
    private onSuccess(operationName?: string): void {
        this.totalSuccesses++;
        this.failureCount = 0; // Reset failure count on success

        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;

            if (this.successCount >= this.config.successThreshold) {
                this.closeCircuit(operationName);
            }
        }
    }

    /**
     * Handle failed request
     */
    private onFailure(operationName?: string): void {
        this.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = new Date();
        this.successCount = 0; // Reset success count on failure

        if (this.state === CircuitState.HALF_OPEN) {
            // Failed during testing - reopen circuit
            this.openCircuit(operationName);
        } else if (this.state === CircuitState.CLOSED) {
            // Check if we should open circuit
            if (this.failureCount >= this.config.failureThreshold) {
                this.openCircuit(operationName);
            }
        }
    }

    /**
     * Open circuit - block all requests
     */
    private openCircuit(operationName?: string): void {
        this.state = CircuitState.OPEN;
        this.lastStateChange = new Date();

        if (this.config.logStateChanges) {
            console.error('🔴 Circuit Breaker: OPEN', {
                operation: operationName,
                failureCount: this.failureCount,
                threshold: this.config.failureThreshold,
                resetTimeout: this.config.resetTimeout
            });
        }

        // Schedule transition to half-open
        this.resetTimer = setTimeout(() => {
            this.halfOpenCircuit();
        }, this.config.resetTimeout);
    }

    /**
     * Transition to half-open state - allow limited testing
     */
    private halfOpenCircuit(): void {
        this.state = CircuitState.HALF_OPEN;
        this.lastStateChange = new Date();
        this.successCount = 0;

        if (this.config.logStateChanges) {
            console.warn('🟡 Circuit Breaker: HALF_OPEN (testing)', {
                successThresholdNeeded: this.config.successThreshold
            });
        }
    }

    /**
     * Close circuit - resume normal operation
     */
    private closeCircuit(operationName?: string): void {
        this.state = CircuitState.CLOSED;
        this.lastStateChange = new Date();
        this.failureCount = 0;
        this.successCount = 0;

        if (this.config.logStateChanges) {
            console.log('🟢 Circuit Breaker: CLOSED (recovered)', {
                operation: operationName
            });
        }

        // Clear reset timer
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = undefined;
        }
    }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Get circuit statistics
     */
    getStats(): CircuitStats {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastStateChange: this.lastStateChange,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses
        };
    }

    /**
     * Check if circuit is open
     */
    isOpen(): boolean {
        return this.state === CircuitState.OPEN;
    }

    /**
     * Check if circuit is closed
     */
    isClosed(): boolean {
        return this.state === CircuitState.CLOSED;
    }

    /**
     * Check if circuit is half-open
     */
    isHalfOpen(): boolean {
        return this.state === CircuitState.HALF_OPEN;
    }

    /**
     * Manually reset circuit (for testing/admin purposes)
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.lastStateChange = new Date();

        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = undefined;
        }

        if (this.config.logStateChanges) {
            console.log('🔄 Circuit Breaker: Manually reset to CLOSED');
        }
    }

    /**
     * Get success rate percentage
     */
    getSuccessRate(): number {
        if (this.totalRequests === 0) return 100;
        return (this.totalSuccesses / this.totalRequests) * 100;
    }
}