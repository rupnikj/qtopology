/** Simple class for collecting telemetry statistics for call durations */
export class Telemetry {

    private cnt: number;
    private min: number;
    private max: number;
    private avg: number;
    private name: string;

    constructor(name: string) {
        this.cnt = 0;
        this.avg = 0;
        this.min = 0;
        this.max = 0;
        this.name = name;
    }

    add(duration: number) {
        if (this.cnt === 0) {
            this.avg = duration;
            this.cnt = 1;
            this.min = duration;
            this.max = duration;
        } else {
            let tc = this.cnt;
            let tc1 = this.cnt + 1;
            this.avg = this.avg * (tc / tc1) + duration / tc1;
            this.cnt++;
            this.min = Math.min(this.min, duration);
            this.max = Math.max(this.max, duration);
        }
    }

    reset() {
        this.cnt = 0;
        this.avg = 0;
        this.min = 0;
        this.max = 0;
    }

    get(add_name?: boolean) {
        if (add_name) {
            return {
                name: this.name,
                cnt: this.cnt,
                avg: this.avg
            };
        }
        return {
            cnt: this.cnt,
            avg: this.avg
        };
    }
}
