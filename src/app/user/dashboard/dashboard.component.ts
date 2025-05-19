import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  records: any[] = [];
  displayedColumns = [
    'checkedInAt',
    'checkedOutAt',
    'checkInLocation',
    'checkOutLocation',
    'duration',
  ];

  isCheckedIn = false;
  currentRecordId: string | null = null;

  elapsedTime = 0; // milliseconds
  timerSubscription?: Subscription;

  userId: string | null = null;

  constructor(private firestore: Firestore, private auth: Auth) {}

  ngOnInit() {
    this.auth.currentUser?.uid
      ? this.initAttendance(this.auth.currentUser.uid)
      : this.auth.onAuthStateChanged((user) => {
          if (user) {
            this.initAttendance(user.uid);
          }
        });
  }

  ngOnDestroy() {
    this.timerSubscription?.unsubscribe();
  }

  private async initAttendance(uid: string) {
    this.userId = uid;
    const attendanceCollection = collection(
      this.firestore,
      `attendance/${uid}/records`
    );

    // Listen for all records ordered by checkedInAt descending
    const attendanceQuery = query(
      attendanceCollection,
      orderBy('checkedInAt', 'desc')
    );
    collectionData(attendanceQuery, { idField: 'id' }).subscribe((data) => {
      this.records = data;

      // Check if currently checked in (record with no checkout)
      const activeRecord = this.records.find((rec) => !rec.checkedOutAt);
      if (activeRecord) {
        this.isCheckedIn = true;
        this.currentRecordId = activeRecord.id;
        this.startTimer(activeRecord.checkedInAt.toDate());
      } else {
        this.isCheckedIn = false;
        this.currentRecordId = null;
        this.stopTimer();
      }
    });
  }

  calculateDuration(checkIn: string | Date, checkOut: string | Date): string {
    if (!checkIn || !checkOut) return '-';

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diffMs = end - start;

    if (diffMs <= 0) return '0s';

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  async onCheckClick() {
    if (!this.userId) return;

    if (!this.isCheckedIn) {
      // CHECK IN

      try {
        const location = await this.getLocation();

        const attendanceCollection = collection(
          this.firestore,
          `attendance/${this.userId}/records`
        );
        const now = new Date();

        const docRef = await addDoc(attendanceCollection, {
          checkedInAt: now,
          checkedOutAt: null,
          checkInLocation: location,
          checkOutLocation: null,
        });

        this.currentRecordId = docRef.id;
        this.isCheckedIn = true;
        this.startTimer(now);
      } catch (error) {
        alert('Failed to get location or check in. ' + error);
      }
    } else {
      // CHECK OUT

      if (!this.currentRecordId) return;

      try {
        const location = await this.getLocation();
        const now = new Date();

        const recordDoc = doc(
          this.firestore,
          `attendance/${this.userId}/records/${this.currentRecordId}`
        );

        await updateDoc(recordDoc, {
          checkedOutAt: now,
          checkOutLocation: location,
        });

        this.isCheckedIn = false;
        this.currentRecordId = null;
        this.stopTimer();
      } catch (error) {
        alert('Failed to check out. ' + error);
      }
    }
  }

  private startTimer(startDate: Date) {
    this.stopTimer();

    this.timerSubscription = interval(1000).subscribe(() => {
      this.elapsedTime = new Date().getTime() - startDate.getTime();
    });
  }

  private stopTimer() {
    this.timerSubscription?.unsubscribe();
    this.elapsedTime = 0;
  }

  private async getLocation(): Promise<string> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation not supported by browser.');
    }

    const coords = await new Promise<GeolocationCoordinates>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          (error) => reject('Permission denied or error getting location.')
        );
      }
    );

    const lat = coords.latitude;
    const lng = coords.longitude;

    // Replace with your OpenCage API key
    const apiKey = '0a783be6b0bc4c71939ce028857967e3';
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch location address.');
    }

    const data = await response.json();
    const address = data.results[0]?.formatted;

    return address || `Lat: ${lat}, Lon: ${lng}`;
  }
}
